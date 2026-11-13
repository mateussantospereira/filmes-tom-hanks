import { useState, useEffect } from "react";
import { Container, h2, Button, Input, Table, TableRow, TableCell, TableHead } from "./ui";

export default function CategoriasList() {
  const [categorias, setCategorias] = useState([]);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [usuarioId, setUsuarioId] = useState(1);

  // Carregar categorias do backend
  useEffect(() => {
    fetch(`/api/categorias?userId=${usuarioId}`)
      .then((r) => r.json())
      .then(setCategorias)
      .catch(console.error);
  }, [usuarioId]);

  const handleCriar = () => {
    fetch("/api/categorias", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome, descricao, criado_por: usuarioId }),
    })
      .then((r) => r.json())
      .then((data) => {
        setCategorias((prev) => [data, ...prev]);
        setNome("");
        setDescricao("");
      });
  };

  return (
    <Container maxWidth="lg" className="mx-auto py-8">
      <h2 className="text-3xl font-bold mb-6">Categorias</h2>

      <div className="flex gap-4 mb-6">
        <Button onClick={() => setNome("") || setDescricao("")} className="flex-1">
          Nova Categoria
        </Button>
      </div>

      <Input
        placeholder="Nome da categoria"
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        className="mb-2"
      />
      <Input
        placeholder="Descrição"
        value={descricao}
        onChange={(e) => setDescricao(e.target.value)}
        className="mb-2"
      />
      <Button onClick={handleCriar} className="mt-2 bg-indigo-600 hover:bg-indigo-700 text-white">
        Salvar Categoria
      </Button>

      <Table className="mt-6 w-full rounded-md overflow-hidden">
        <TableHead>
          <TableCell>Nome</TableCell>
          <TableCell>Descrição</TableCell>
          <TableCell>Ações</TableCell>
        </TableHead>
        {categorias.map((c) => (
          <TableRow key={c.id} className="border-b">
            <TableCell>{c.nome}</TableCell>
            <TableCell>{c.descricao || "-"}</TableCell>
            <TableCell>
              <Button
                className="text-sm text-red-600 hover:underline"
                onClick={() => console.log("Excluir", c.id)}
              >
                Excluir
              </Button>
              <Button
                className="text-sm text-blue-600 hover:underline ml-2"
                onClick={() => console.log("Editar", c.id)}
              >
                Editar
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </Table>
    </Container>
  );
}