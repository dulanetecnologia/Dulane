const {
  enviarEmail,
  erroDeValidacao,
  paraAnexoNodemailer,
  montarTextoPlano,
  montarEmailHtml,
  aplicarCors,
  urlDaLogo,
} = require('./_lib/mailer');

module.exports = async function handler(req, res) {
  if (aplicarCors(req, res)) return;

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const {
    name,
    document,
    address,
    email,
    phone,
    preferredDate,
    preferredTime,
    description,
    anexoImagem,
    anexoDocumento,
  } = req.body || {};

  if (!name || !email || !description) {
    return res.status(400).json({
      error: 'Campos obrigatórios: name, email, description',
    });
  }

  const erroValidacao = erroDeValidacao({ email, document, preferredDate, preferredTime });
  if (erroValidacao) {
    return res.status(400).json({ error: erroValidacao });
  }

  // GMAIL_USER currently authenticates as a shared account (see .env.local),
  // not one dedicated to Dulane, so it must never receive leads as a
  // fallback destination — fail loudly instead of misdelivering.
  if (!process.env.MAIL_TO) {
    console.error('MAIL_TO não configurado - recusando enviar para evitar entrega incorreta.');
    return res.status(500).json({ error: 'Configuração de e-mail incompleta' });
  }

  let attachments;
  try {
    attachments = [paraAnexoNodemailer(anexoImagem), paraAnexoNodemailer(anexoDocumento)].filter(
      Boolean,
    );
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }

  try {
    const campos = {
      name,
      document,
      address,
      email,
      phone,
      preferredDate,
      preferredTime,
      description,
    };

    const html = montarEmailHtml({
      logoUrl: urlDaLogo('logo-dulane.png'),
      logoAlt: 'Dulane Gestão e Tecnologia',
      logoLargura: 140,
      logoAltura: 53,
      corPrimaria: '#f26522',
      corEscura: '#131a2b',
      corFundoSuave: 'rgba(242, 101, 34, 0.06)',
      corFundoTopo: '#131a2b',
      corTextoTopo: '#b9c0d0',
      subtitulo: 'Nova solicitação recebida pelo site',
      siteUrl: 'https://dulane.com.br',
      campos,
      temAnexo: attachments.length > 0,
    });

    await enviarEmail({
      from: `"Formulário Dulane" <${process.env.GMAIL_USER}>`,
      to: process.env.MAIL_TO,
      replyTo: email,
      subject: `Nova solicitação recebida pelo site - ${name}`,
      text: montarTextoPlano(campos),
      html,
      attachments,
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Erro ao enviar email:', error);
    return res.status(500).json({ error: 'Falha ao enviar email' });
  }
};
