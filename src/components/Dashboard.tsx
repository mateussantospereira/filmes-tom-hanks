import { useState, useEffect } from "react";
import { Container, h2, Button, Nav, NavItem } from "./ui";

export default function Dashboard() {
  const [userId, setUserId] = useState(1);

  return (
    <Container maxWidth="lg" className="mx-auto py-8">
      <h2 className="text-3xl font-bold mb-6">Dashboard - {userId}</h2>

      <Nav>
        <NavItem onClick={() => console.log("Landing")}>Início</NavItem>
        <NavItem onClick={() => console.log("Categorias")}>Categorias</NavItem>
        <NavItem onClick={() => console.log("Agendamentos")}>Agendamentos</NavItem>
        <NavItem onClick={() => console.log("Participações")}>Minhas Participações</NavItem>
      </Nav>

      <p className="text-sm text-muted-foreground mb-4">
        Bem-vindo ao MetaSass — sua plataforma de agendamento e gestão de serviços.
      </p>

      <Button onClick={() => console.log("Novo Post")}>Novo Agendamento</Button>
    </Container>
  );
}