import { useState, useEffect } from "react";
import { Container, h2, Button, Table, TableRow, TableCell, TableHead } from "./ui";

export default function ParticipacoesList() {
  const [participacoes, setParticipacoes] = useState([]);
  const [usuarioId, setUsuarioId] = useState(1);

  // Carregar participacoes do backend
  useEffect(() => {
    fetch(`/api/participacoes?userId=${usuarioId}`)
      .then((r) => r.json())
      .then(setParticipacoes)
      .catch(console.error);
  }, [usuarioId]);

  return (
    <Container maxWidth="lg" className="mx-auto py-8">
      <h2 className="text-3xl font-bold mb-6">Minhas Participações</h2>

      <Table className="mt-6 w-full rounded-md overflow-hidden">
        <TableHead>
          <TableCell>Agendamento</TableCell>
          <TableCell>Papel</TableCell>
          <TableCell>Confirmado</TableCell>
          <TableCell>Ações</TableCell>
        </TableHead>
        {participacoes.map((p) => (
          <TableRow key={p.id} className="border-b">
            <TableCell>
              <div>{p.agendamento_titulo || "—"}</div>
              <div className="text-xs text-muted-foreground">ID: {p.agendamento_id}</div>
            </TableCell>
            <TableCell>
              <span
                className={`px-2 py-1 text-xs rounded ${p.papel === "motorista" ? "bg-indigo-100 text-indigo-800" : "bg-green-100 text-green-800"}`}
              >
                {p.papel}
              </span>
            </TableCell>
            <TableCell>
              <span
                className={`px-2 py-1 text-xs rounded ${p.confirmado ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}`}
              >
                {p.confirmado ? "Sim" : "Não"}
              </span>
            </TableCell>
            <TableCell>
              <Button
                className="text-sm text-blue-600 hover:underline"
                onClick={() => console.log("Detalhar", p.id)}
              >
                Detalhar
              </Button>
              <Button
                className="text-sm text-red-600 hover:underline ml-2"
                onClick={() => console.log("Excluir", p.id)}
              >
                Excluir
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </Table>
    </Container>
  );
}