import { useState } from "react";
import { Container, h2, p, Button, Input } from "./ui";

export default function LandingPage() {
  const [plan, setPlan] = useState<"free" | "pro">("free");

  return (
    <Container maxWidth="lg" className="mx-auto py-12">
      <h2 className="text-4xl font-bold mb-6">MetaSass</h2>

      <p className="text-lg text-muted-foreground mb-8">
        Plataforma de agendamento e gestão de serviços para pequenos lojistas e comércios locais.
      </p>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Plano Gratuito */}
        <div className="bg-gray-50 rounded-lg p-6">
          <h3 className="text-xl font-semibold mb-2">Plano Grátis</h3>
          <p className="text-muted-foreground mb-4">
            Até 5 agendamentos. Funcionalidades básicas.
          </p>
          <ul className="list-disc list-inside text-sm text-muted-foreground">
            <li>5 agendamentos máximo</li>
            <li>Acesso ao painel de controle</li>
            <li>Visualização de categorias</li>
            <li>Criação de agendamentos</li>
          </ul>
          <Button
            onClick={() => setPlan("free")}
            className="mt-4 w-full bg-green-500 hover:bg-green-600 text-white"
          >
            Começar de Graça
          </Button>
        </div>

        {/* Plano Pro */}
        <div className="bg-indigo-50 rounded-lg p-6">
          <h3 className="text-xl font-semibold mb-2">Plano Pro</h3>
          <p className="text-muted-foreground mb-4">
            R$ 29,00/mês — Agendamentos ilimitados + todas as funcionalidades
          </p>
          <ul className="list-disc list-inside text-sm text-muted-foreground">
            <li>Agendamentos ilimitados</li>
            <li>Todas as categorias e participações</li>
            <li>Upload de arquivos (MinIO)</li>
            <li>Relatórios e logs</li>
            <li>Suporte prioritário</li>
          </ul>
          <Button
            onClick={() => setPlan("pro")}
            className="mt-4 w-full bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            Assinar Pro – R$ 29/mês
          </Button>
        </div>
      </div>

      <div className="mt-8 p-6 bg-indigo-50 rounded-lg">
        <h3 className="text-xl font-semibold mb-3">Como funciona</h3>
        <ol className="list-decimal list-inside text-sm text-muted-foreground">
          <li>Crie uma conta e defina seu plano</li>
          <li>Cadastre categorias do seu serviço (ex.: carona, consulta, entrega)</li>
          <li>Crie agendamentos com data, hora e categoria</li>
          <li>Outros usuários podem participar como motorista ou passageiro</li>
          <li>Gerencie participações e visualize logs de auditoria</li>
        </ol>
      </div>
    </Container>
  );
}