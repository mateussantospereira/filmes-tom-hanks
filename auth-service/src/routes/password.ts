import { Hono } from "hono";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { usuarios } from "../db/schema";
import { config } from "../config";
import { emitirToken, reservarToken, validarToken, type MotivoRecusa } from "../services/reset-token";
import { enviarEmailRecuperacao } from "../mail";

/**
 * Requisitos 4, 5 e 6 — esqueci minha senha.
 *
 * O link de redefinicao aponta para o CATALOGO (porta publica do subdominio),
 * nao para este servico: o catalego repassa a validacao para ca por dentro da
 * rede do Docker. Por isso o link e montado com APP_PUBLIC_URL.
 */

const password = new Hono();

const TAMANHO_MINIMO_SENHA = 6;

/**
 * Mesma resposta para e-mail cadastrado e para e-mail inexistente. Se
 * respondessemos "e-mail nao encontrado", qualquer um testaria a base de
 * usuarios do sistema so digitando enderecos aqui.
 */
const RESPOSTA_NEUTRA =
  "Se houver uma conta com esse e-mail, enviaremos um link de redefinição de senha.";

password.post("/forgot-password", async (c) => {
  const { email } = await c.req.json().catch(() => ({}));

  if (!email) {
    return c.json({ error: "Email é obrigatório" }, 400);
  }

  const rows = await db
    .select({ id: usuarios.id, nome: usuarios.nome, email: usuarios.email })
    .from(usuarios)
    .where(eq(usuarios.email, String(email).toLowerCase()))
    .limit(1);

  if (rows.length > 0) {
    const usuario = rows[0];
    const { token, expiraEm } = await emitirToken(usuario.id);
    const link = `${config.app.publicUrl}${config.reset.path}?token=${token}`;

    const envio = await enviarEmailRecuperacao(usuario.email, usuario.nome, link, expiraEm);

    if (!envio.enviado) {
      // Falhou o envio de verdade: devolvemos 502 para o catalogo repassar.
      // O usuario pode tentar de novo; o token criado fica invalido na proxima tentativa.
      return c.json({ error: "Não foi possível enviar o e-mail agora. Tente novamente." }, 502);
    }
  }

  return c.json({ message: RESPOSTA_NEUTRA });
});

const MENSAGEM_POR_MOTIVO: Record<MotivoRecusa, string> = {
  inexistente: "Link inválido. Peça um novo link de recuperação de senha.",
  usado: "Este link já foi utilizado. Peça um novo link de recuperação de senha.",
  expirado: `Este link expirou (válido por ${config.reset.ttlMinutos} ${
    config.reset.ttlMinutos === 1 ? "minuto" : "minutos"
  }). Peça um novo link.`,
};

password.post("/reset-password", async (c) => {
  const { token, novaSenha } = await c.req.json().catch(() => ({}));

  if (!token || !novaSenha) {
    return c.json({ error: "Token e nova senha são obrigatórios" }, 400);
  }

  if (String(novaSenha).length < TAMANHO_MINIMO_SENHA) {
    return c.json({ error: `A nova senha deve ter no mínimo ${TAMANHO_MINIMO_SENHA} caracteres` }, 400);
  }

  // 1) o token existe?  2) ainda nao foi usado?  3) ainda nao expirou?
  const validacao = await validarToken(String(token));
  if (!validacao.ok) {
    return c.json({ error: MENSAGEM_POR_MOTIVO[validacao.motivo] }, 400);
  }

  // Reserva atomica: se o link ja foi clicado (por outra requisicao, agora
  // mesmo), esta chamada e recusada em vez de trocar a senha duas vezes.
  if (!(await reservarToken(validacao.registro.id))) {
    return c.json({ error: MENSAGEM_POR_MOTIVO.usado }, 400);
  }

  const senhaHash = await bcrypt.hash(String(novaSenha), 10);
  await db
    .update(usuarios)
    .set({ senhaHash })
    .where(eq(usuarios.id, validacao.registro.usuarioId));

  return c.json({ message: "Senha alterada com sucesso. Faça login com a nova senha." });
});

export default password;
