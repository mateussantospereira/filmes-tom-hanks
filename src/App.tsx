import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { useState, useEffect } from "react";
import { Container, Button, h2, p } from "./components/ui";
import LandingPage from "./components/LandingPage";
import Dashboard from "./components/Dashboard";
import PostModal from "./components/PostModal";
import CategoriasList from "./components/CategoriasList";
import AgendamentosList from "./components/AgendamentosList";
import ParticipacoesList from "./components/ParticipacoesList";

function App() {
  const [userId, setUserId] = useState<number | null>(null);

  // Tenta obter ou criar usuário na inicialização
  useEffect(() => {
    const checkUser = async () => {
      // Em um app real, isso seria uma API call. Aqui simulamos.
      setUserId(1); // Usuário ID 1 (o único cadastrado no SQLite)
    };
    checkUser();
  }, []);

  return (
    <Router>
      <Container maxWidth="lg" className="mx-auto py-8">
        <h2 className="text-2xl font-bold mb-6">MetaSass - Domínio do Negócio</h2>
        <nav className="mb-6">
          <Button
            onClick={() => setUserId(1)}
            className="bg-indigo-6 hover:bg-indigo-7 text-white"
          >
            Entrar como Usuário 1
          </Button>
        </nav>

        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/categorias" element={<CategoriasList />} />
          <Route path="/agendamentos" element={<AgendamentosList />} />
          <Route path="/participacoes" element={<ParticipacoesList />} />
          <Route path="/post" element={<PostModal />} />
        </Routes>
      </Container>
    </Router>
  );
}

export default App;