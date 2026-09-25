import { createTransport } from "nodemailer";
import type { Transporter } from "nodemailer";
import { config } from "./config";

/**
 * Requisito 5 — envio real de e-mail.
 *
 * O transporte e o mesmo em qualquer ambiente; o que muda sao as variaveis:
 *
 *   Desenvolvimento -> Mailtrap (sandbox): smtp.mailtrap.io:2525
 *                    o e-mail NAO sai de fato para o mundo, mas chega na
 *                    inbox da conta Mailtrap exatamente como seria entregue.
 *   Producao       -> Brevo (envio transacional): smtp-relay.brevo.com:587
 *
 * Se MAIL_HOST nao estiver definido, em desenvolvimento o link cai no log
 * (para conseguir testar a feature sem credencial). Em producao isso e erro
 * de configuracao e o envio falha — nunca "simula" sucesso em producao.
 */

let transporte: Transporter | null | undefined;

function obterTransporte(): Transporter | null {
  if (transporte !== undefined) return transporte;

  const { host, port, user, pass } = config.mail;

  if (!host) {
    if (config.production) {
      throw new Error(
        "[auth-service] MAIL_HOST nao configurado: em producao o e-mail de recuperacao de senha e obrigatorio."
      );
    }
    console.warn(
      "[auth-service] MAIL_HOST vazio — ambiente de DESENVOLVIMENTO sem SMTP.\n" +
        "               O link de redefinicao sera impresso no log em vez de enviado.\n" +
        "               Para ver o e-mail de verdade, configure o Mailtrap (auth-service/.env.example)."
    );
    transporte = null;
    return transporte;
  }

  transporte = createTransport({
    host,
    port,
    secure: port === 465,
    auth: user ? { user, pass } : undefined,
  });

  return transporte;
}

export type ResultadoEnvio = { enviado: true; via: "smtp" | "log" } | { enviado: false; erro: string };

function minutosRestantes(expiraEm: Date): number {
  return Math.max(0, Math.round((expiraEm.getTime() - Date.now()) / 60_000));
}

function conteudoEmail(nome: string, link: string, expiraEm: Date) {
  const minutos = config.reset.ttlMinutos;
  const validoAte = expiraEm.toLocaleString("pt-BR");

  return {
    assunto: `Redefinição de senha — ${config.mail.fromName}`,
    texto:
      `Olá, ${nome}!\n\n` +
      `Recebemos um pedido de redefinição de senha para a sua conta no ${config.mail.fromName}.\n\n` +
      `Clique no link abaixo para escolher uma nova senha:\n${link}\n\n` +
      `O link é válido por ${minutos} minutos (até ${validoAte}) e só pode ser usado uma vez.\n\n` +
      `Se não foi você, pode ignorar este e-mail: nada muda na sua conta.\n`,
    html: `
      <div style="font-family:Segoe UI,Arial,sans-serif;background:#1a1a2e;padding:24px">
        <div style="max-width:520px;margin:0 auto;background:#16213e;border-radius:8px;padding:32px;color:#eee">
          <h1 style="margin:0 0 4px;font-size:20px">🎬 ${config.mail.fromName}</h1>
          <p style="color:#999;margin:0 0 24px">Recuperação de senha</p>

          <p>Olá, <strong>${nome}</strong>!</p>
          <p>Recebemos um pedido de redefinição de senha para a sua conta. Clique no botão abaixo para escolher uma nova senha:</p>

          <p style="margin:28px 0">
            <a href="${link}" style="background:#e94560;color:#fff;text-decoration:none;padding:14px 24px;border-radius:8px;font-weight:bold;display:inline-block">
              Redefinir minha senha
            </a>
          </p>

          <p style="font-size:13px;color:#999">Se o botão não funcionar, copie e cole este endereço no navegador:</p>
          <p style="font-size:13px;word-break:break-all"><a href="${link}" style="color:#e94560">${link}</a></p>

          <hr style="border:none;border-top:1px solid #333;margin:24px 0">
          <p style="font-size:13px;color:#999">
            ⏳ Este link é válido por <strong style="color:#eee">${minutos} minutos</strong> (até ${validoAte}) e só pode ser usado uma vez.
            Depois disso é preciso pedir um novo link.
          </p>
          <p style="font-size:13px;color:#999">Se não foi você, pode ignorar este e-mail — nada muda na sua conta.</p>
        </div>
      </div>
    `.trim(),
  };
}

/**
 * Envia o link de redefinicao. Retorna `via: "log"` quando o SMTP nao esta
 * configurado em desenvolvimento (link impresso no console).
 */
export async function enviarEmailRecuperacao(
  destino: string,
  nome: string,
  link: string,
  expiraEm: Date
): Promise<ResultadoEnvio> {
  const { assunto, texto, html } = conteudoEmail(nome, link, expiraEm);
  const transporteAtual = obterTransporte();

  if (!transporteAtual) {
    console.warn(
      `\n[auth-service] === E-mail de recuperacao (modo log, sem SMTP) ===\n` +
        `para:  ${destino}\n` +
        `link:  ${link}\n` +
        `expira em ${expiraEm.toLocaleString("pt-BR")} (${minutosRestantes(expiraEm)} min restantes)\n` +
        `==============================================================\n`
    );
    return { enviado: true, via: "log" };
  }

  try {
    await transporteAtual.sendMail({
      from: config.mail.from
        ? `"${config.mail.fromName}" <${config.mail.from}>`
        : undefined,
      to: destino,
      subject: assunto,
      text: texto,
      html,
    });
    return { enviado: true, via: "smtp" };
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : String(erro);
    console.error(`[auth-service] falha ao enviar e-mail para ${destino}: ${mensagem}`);
    return { enviado: false, erro: mensagem };
  }
}
