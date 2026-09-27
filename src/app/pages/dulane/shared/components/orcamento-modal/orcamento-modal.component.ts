import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  ViewChild,
  effect,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonComponent } from '../button/button.component';
import { MarcaOrcamento, OrcamentoService } from './orcamento.service';
import {
  faixaHorarioDoDia,
  isDiaUtil,
  isHorarioValido,
  isTodayOrFuture,
  isValidCnpj,
  isValidCpf,
  isValidEmail,
  todayIso,
} from './orcamento-validators';

type TipoPessoa = 'fisica' | 'juridica';
type StatusEnvio = 'idle' | 'enviando' | 'sucesso' | 'erro';
type Toast = { tipo: 'sucesso' | 'erro'; mensagem: string };
type TipoAnexo = 'imagem' | 'documento';
type Anexo = { nome: string; tipo: string; base64: string };

const DURACAO_TOAST_MS = 5000;
// Kept well under Vercel's request body limit, since both files travel as
// base64 (~33% larger) inside the same JSON payload as the rest of the form.
const TAMANHO_MAX_ANEXO_BYTES = 3 * 1024 * 1024;

// A relative path, in both dev and production: in production, Vercel serves
// this static site and the /api functions from the same origin by default,
// so no absolute URL is needed. If Dulane's static site ever ends up served
// from a host that can't also run the /api functions (e.g. AWS S3/
// CloudFront), switch this to an absolute URL pointing at wherever the API
// itself is deployed.
// While running `ng serve`, this same relative path goes through the dev
// server's own proxy (see proxy.conf.json), which forwards it server-to-
// server to the local API (`npm run api`, port 3557 — a plain Node server
// that serves the same /api handlers without needing a Vercel login). That
// keeps testing working from any device that can reach ng serve's port
// (e.g. a phone via Chrome's remote-debugging port forwarding) without also
// needing port 3557 reachable or open to CORS.
const API_BASE_URL = '';

// Quote request modal: form, validation and submission via the /api/send-email backend.
@Component({
  selector: 'app-orcamento-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonComponent],
  templateUrl: './orcamento-modal.component.html',
  styleUrl: './orcamento-modal.component.scss',
})
export class OrcamentoModalComponent {
  @ViewChild('orcamentoForm') formRef!: ElementRef<HTMLFormElement>;

  private readonly orcamentoService = inject(OrcamentoService);
  readonly isOpen = this.orcamentoService.isOpen;
  readonly marca = this.orcamentoService.marca;

  tipoPessoa = signal<TipoPessoa>('fisica');
  status = signal<StatusEnvio>('idle');
  tentouEnviar = signal(false);
  // Fields the visitor has already left (blurred), so their errors show right
  // away instead of only after the first submit attempt.
  private readonly camposTocados = signal<ReadonlySet<string>>(new Set());
  toast = signal<Toast | null>(null);
  private toastTimeoutId?: ReturnType<typeof setTimeout>;

  nome = '';
  documento = '';
  endereco = '';
  email = '';
  telefone = '';
  descricao = '';
  dataPreferida = '';
  horaPreferida = '';

  imagemArquivo = signal<File | null>(null);
  documentoArquivo = signal<File | null>(null);
  imagemErro = signal<string | null>(null);
  documentoErro = signal<string | null>(null);

  // Earliest selectable date: today in the visitor's local time zone.
  readonly dataMinima = todayIso();

  // Locks page scroll while the modal is open.
  constructor() {
    effect(() => {
      document.body.style.overflow = this.isOpen() ? 'hidden' : '';
    });
  }

  // Closes the modal and clears the form, so reopening it always starts fresh.
  fechar(): void {
    this.orcamentoService.fechar();
    this.reiniciar();
  }

  // Suffixes a field's id/name with the active brand, so that if this
  // project ever mounts a second LP sharing this same form, the two never
  // share an id/name — this keeps browser autofill from mixing up
  // remembered values between them.
  campoId(base: string): string {
    return `${base}-${this.marca()}`;
  }

  // Dismisses the success/error toast.
  fecharToast(): void {
    this.toast.set(null);
    clearTimeout(this.toastTimeoutId);
  }

  // Marks a field as visited, which lets its validation error show.
  tocar(campo: string): void {
    this.camposTocados.update((campos) => new Set(campos).add(campo));
  }

  // True when a field's error should be visible: it's invalid and either the
  // visitor already left the field or tried to submit. After that the error
  // updates live as they type, and disappears as soon as the value is valid.
  mostrarErro(campo: string, invalido: boolean): boolean {
    return invalido && (this.tentouEnviar() || this.camposTocados().has(campo));
  }

  // Switches between individual (CPF) and company (CNPJ) and clears the document field.
  selecionarTipoPessoa(tipo: TipoPessoa): void {
    this.tipoPessoa.set(tipo);
    this.documento = '';
    // The field was just emptied, so don't flag it as an error until it's visited again.
    this.camposTocados.update((campos) => {
      const restantes = new Set(campos);
      restantes.delete('documento');
      return restantes;
    });
  }

  // Formats the document field as CPF or CNPJ while typing.
  onDocumentoInput(event: Event): void {
    const digitos = (event.target as HTMLInputElement).value.replace(/\D/g, '');
    this.documento =
      this.tipoPessoa() === 'fisica'
        ? this.mascararCpf(digitos)
        : this.mascararCnpj(digitos);
  }

  // Formats the phone field while typing.
  onTelefoneInput(event: Event): void {
    const digitos = (event.target as HTMLInputElement).value.replace(/\D/g, '');
    this.telefone = this.mascararTelefone(digitos);
  }

  // Applies the CPF mask (000.000.000-00).
  private mascararCpf(digitos: string): string {
    return digitos
      .slice(0, 11)
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  }

  // Applies the CNPJ mask (00.000.000/0000-00).
  private mascararCnpj(digitos: string): string {
    return digitos
      .slice(0, 14)
      .replace(/(\d{2})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1/$2')
      .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
  }

  // Validates and stores a selected image or document, clearing it on error.
  // Images are downscaled/recompressed first — a phone camera photo is
  // routinely 5-15 MB, which used to get rejected outright (or sent as a
  // multi-MB base64 payload that struggled on a slow mobile connection).
  async onArquivoSelecionado(event: Event, tipo: TipoAnexo): Promise<void> {
    const input = event.target as HTMLInputElement;
    let arquivo = input.files?.[0] ?? null;
    const arquivoSignal = tipo === 'imagem' ? this.imagemArquivo : this.documentoArquivo;
    const erroSignal = tipo === 'imagem' ? this.imagemErro : this.documentoErro;

    if (!arquivo) {
      arquivoSignal.set(null);
      erroSignal.set(null);
      return;
    }

    if (tipo === 'imagem' && arquivo.type.startsWith('image/')) {
      try {
        arquivo = await this.comprimirImagem(arquivo);
      } catch {
        // Keeps the original file if compression fails for any reason
        // (unsupported format, canvas unavailable) — the size check below
        // still guards against sending something too large.
      }
    }

    if (arquivo.size > TAMANHO_MAX_ANEXO_BYTES) {
      arquivoSignal.set(null);
      erroSignal.set('Arquivo muito grande. Tamanho máximo: 3 MB.');
      input.value = '';
      return;
    }

    arquivoSignal.set(arquivo);
    erroSignal.set(null);
  }

  // Downscales an image to at most 1600px on its longest side and
  // re-encodes it as JPEG at 75% quality — a typical phone photo (often
  // 3000px+ and several MB) comes out well under 1 MB with no visible loss
  // for an email attachment.
  private comprimirImagem(arquivo: File): Promise<File> {
    const TAMANHO_MAX_LADO = 1600;
    const QUALIDADE_JPEG = 0.75;

    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(arquivo);
      const imagem = new Image();

      imagem.onload = () => {
        URL.revokeObjectURL(url);

        let { width, height } = imagem;
        if (width > TAMANHO_MAX_LADO || height > TAMANHO_MAX_LADO) {
          const escala = TAMANHO_MAX_LADO / Math.max(width, height);
          width = Math.round(width * escala);
          height = Math.round(height * escala);
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const contexto = canvas.getContext('2d');
        if (!contexto) {
          reject(new Error('Não foi possível processar a imagem.'));
          return;
        }
        contexto.drawImage(imagem, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Não foi possível processar a imagem.'));
              return;
            }
            const nome = arquivo.name.replace(/\.\w+$/, '') + '.jpg';
            resolve(new File([blob], nome, { type: 'image/jpeg' }));
          },
          'image/jpeg',
          QUALIDADE_JPEG,
        );
      };

      imagem.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Não foi possível ler a imagem.'));
      };

      imagem.src = url;
    });
  }

  // Reads a File as a base64 string (without the "data:...;base64," prefix).
  private lerComoBase64(arquivo: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const resultado = reader.result as string;
        resolve(resultado.split(',')[1] ?? '');
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(arquivo);
    });
  }

  // Converts a selected file into the { nome, tipo, base64 } shape the backend expects.
  private async paraAnexo(arquivo: File | null): Promise<Anexo | null> {
    if (!arquivo) return null;
    return {
      nome: arquivo.name,
      tipo: arquivo.type || 'application/octet-stream',
      base64: await this.lerComoBase64(arquivo),
    };
  }

  // Applies the phone mask, handling both 10 and 11-digit numbers.
  private mascararTelefone(digitosBrutos: string): string {
    const digitos = digitosBrutos.slice(0, 11);
    if (digitos.length <= 10) {
      return digitos
        .replace(/(\d{2})(\d)/, '($1) $2')
        .replace(/(\d{4})(\d{1,4})$/, '$1-$2');
    }
    return digitos
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{5})(\d{1,4})$/, '$1-$2');
  }

  // Converts the native ISO date value to BR format for the hidden form field sent by email.
  get dataPreferidaBr(): string {
    if (!this.dataPreferida) return '';
    const [ano, mes, dia] = this.dataPreferida.split('-');
    return `${dia}/${mes}/${ano}`;
  }

  // True when the name (or company name) field has at least two characters.
  get nomeValido(): boolean {
    return this.nome.trim().length > 1;
  }

  // True when the address field has enough characters to be meaningful.
  get enderecoValido(): boolean {
    return this.endereco.trim().length > 3;
  }

  // True when the document field has a valid CPF (individual) or CNPJ (company),
  // check digits included.
  get documentoValido(): boolean {
    return this.tipoPessoa() === 'fisica'
      ? isValidCpf(this.documento)
      : isValidCnpj(this.documento);
  }

  // True when the email field is a well-formed address.
  get emailValido(): boolean {
    return isValidEmail(this.email);
  }

  // The preferred date must be filled in, can't be in the past, and can't be
  // a Sunday (the business doesn't attend that day).
  // The native `min` only limits the picker; a typed or pasted date bypasses it.
  get dataValida(): boolean {
    return (
      !!this.dataPreferida &&
      isTodayOrFuture(this.dataPreferida) &&
      isDiaUtil(this.dataPreferida)
    );
  }

  // True when the phone field has enough digits.
  get telefoneValido(): boolean {
    return this.telefone.replace(/\D/g, '').length >= 10;
  }

  // The earliest bookable time for the selected date (08:00 every attended
  // day) — used as the time input's `min`. Defaults to weekday hours before
  // a date is chosen.
  get horarioMin(): string {
    return faixaHorarioDoDia(this.dataPreferida)?.min ?? '08:00';
  }

  // The latest bookable time for the selected date: 18:00 Monday-Friday —
  // used as the time input's `max`.
  get horarioMax(): string {
    return faixaHorarioDoDia(this.dataPreferida)?.max ?? '18:00';
  }

  // True when the preferred time is within attendance hours for the
  // selected date (Monday-Friday 8h-18h).
  get horaValida(): boolean {
    return isHorarioValido(this.horaPreferida, this.dataPreferida);
  }

  // True when the case description has enough characters to be meaningful.
  get descricaoValida(): boolean {
    return this.descricao.trim().length > 3;
  }

  // True when all required fields pass validation.
  get formularioValido(): boolean {
    return (
      this.nomeValido &&
      this.documentoValido &&
      this.enderecoValido &&
      this.emailValido &&
      this.telefoneValido &&
      this.dataValida &&
      this.horaValida &&
      this.descricaoValida
    );
  }

  // Validates and submits the form to the backend, then shows a success/error toast.
  async enviar(): Promise<void> {
    this.tentouEnviar.set(true);
    if (!this.formularioValido || this.status() === 'enviando') {
      return;
    }

    this.status.set('enviando');

    try {
      const [anexoImagem, anexoDocumento] = await Promise.all([
        this.paraAnexo(this.imagemArquivo()),
        this.paraAnexo(this.documentoArquivo()),
      ]);

      const endpoints: Record<MarcaOrcamento, string> = {
        dulane: `${API_BASE_URL}/api/send-email`,
      };
      const endpoint = endpoints[this.orcamentoService.marca()];

      const resposta = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: this.nome,
          document: this.documento,
          address: this.endereco,
          email: this.email,
          phone: this.telefone,
          preferredDate: this.dataPreferidaBr,
          preferredTime: this.horaPreferida,
          description: this.descricao,
          anexoImagem,
          anexoDocumento,
        }),
      });

      if (!resposta.ok) {
        throw new Error(`Falha no envio: ${resposta.status}`);
      }

      this.status.set('sucesso');
      this.fechar();
      this.mostrarToast(
        'sucesso',
        'Solicitação enviada! Nossa equipe vai entrar em contato em breve.',
      );
    } catch (erro) {
      console.error('Erro ao enviar solicitação de orçamento:', erro);
      this.status.set('erro');
      this.mostrarToast(
        'erro',
        'Não conseguimos enviar sua solicitação agora. Tente novamente.',
      );
    }
  }

  // Shows a toast and schedules its automatic dismissal.
  private mostrarToast(tipo: Toast['tipo'], mensagem: string): void {
    this.toast.set({ tipo, mensagem });
    clearTimeout(this.toastTimeoutId);
    this.toastTimeoutId = setTimeout(() => this.toast.set(null), DURACAO_TOAST_MS);
  }

  // Resets the form fields and status after a successful submission.
  private reiniciar(): void {
    this.nome = '';
    this.documento = '';
    this.endereco = '';
    this.email = '';
    this.telefone = '';
    this.descricao = '';
    this.dataPreferida = '';
    this.horaPreferida = '';
    this.imagemArquivo.set(null);
    this.documentoArquivo.set(null);
    this.imagemErro.set(null);
    this.documentoErro.set(null);
    this.tentouEnviar.set(false);
    this.camposTocados.set(new Set());
    this.status.set('idle');
    this.formRef?.nativeElement?.reset();
  }
}
