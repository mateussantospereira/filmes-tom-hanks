import { useState, useEffect } from "react";
import { Container, h2, Button, Input, Table, TableRow, TableCell, TableHead } from "./ui";

export default function AgendamentosList() {
  const [agendamentos, setAgendamentos] = useState([]);
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [dataHorario, setDataHorario] = useState("");
  const [categoriaId, setCategoriaId] = useState(1);
  const [usuarioId, setUsuarioId] = useState(1);

  // Carregar agendamentos do backend
  useEffect(() => {
    fetch(`/api/agendamentos?userId=${usuarioId}`)
      .then((r) => r.json())
      .then(setAgendamentos)
      .catch(console.error);
  }, [usuarioId]);

  const handleCriar = () => {
    fetch("/api/agendamentos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        usuarioId,
        categoriaId,
        titulo,
        descricao,
        dataHorario,
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        setAgendamentos((prev) => [data, ...prev]);
        setTitulo("");
        setDescricao("");
        setDataHorario("");
        setCategoriaId(1);
      });
  };

  return (
    <Container maxWidth="lg" className="mx-auto py-8">
      <h2 className="text-3xl font-bold mb-6">Meus Agendamentos</h2>

      <div className="grid grid-cols-2 gap-2 mb-4">
        <Input
          placeholder="Título"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          className="span-full"
        />
        <Input
          placeholder="Descrição"
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          className="span-full mb-2"
        />
      </div>
      
      <Input
        type="datetime-local"
        value={dataHorario}
        onChange={(e) => setDataHorario(e.target.value)}
        className="span-full w-full mb-2 rounded-md border"
      />
      
      <Input
        placeholder="Categoria"
        value={categoriaId}
        onChange={(e) => setCategoriaId(Number(e.target.value))}
        className="span-full w-full mb-2 rounded-md border"
      />
      
      <Button onClick={handleCriar} className="mt-2 w-full bg-green-600 hover:bg-green-700 text-white">
        Agendar
      </Button>

      <Table className="mt-6 w-full rounded-md overflow-hidden">
        <TableHead>
          <TableCell>Título</TableCell>
          <TableCell>Data/Hora</TableCell>
          <TableCell>Categoria</TableCell>
          <TableCell>Status</TableCell>
          <TableCell>Ações</TableCell>
        </TableHead>
        {agendamentos.map((a) => (
          <TableRow key={a.id} className="border-b">
            <TableCell>{a.titulo}</TableCell>
            <TableCell>{new Date(a.data_horario).toLocaleString()}</TableCell>
            <TableCell>{a.categoria ?? "—"}</TableCell>
            <TableCell>
              <span
                className={`px-2 py-1 text-xs rounded ${a.status === "agendado" ? "bg-yellow-100 text-yellow-800" : "bg-green-100 text-green-800"}`}
              >
                {a.status}
              </span>
            </TableCell>
            <TableCell>
              <Button
                className="text-sm text-blue-600 hover:underline"
                onClick={() => console.log("Ver/Editar", a.id)}
              >
                Ver
              </Button>
              <Button
                className="text-sm text-red-600 hover:underline ml-2"
                onClick={() => console.log("Excluir", a.id)}
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