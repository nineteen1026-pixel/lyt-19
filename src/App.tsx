import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Layout from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import ToolList from "@/pages/ToolList";
import ToolForm from "@/pages/ToolForm";
import BorrowList from "@/pages/BorrowList";
import BorrowForm from "@/pages/BorrowForm";
import DepositList from "@/pages/DepositList";
import DamageList from "@/pages/DamageList";
import DamageForm from "@/pages/DamageForm";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="tools" element={<ToolList />} />
          <Route path="tools/new" element={<ToolForm />} />
          <Route path="tools/:id/edit" element={<ToolForm />} />
          <Route path="borrows" element={<BorrowList />} />
          <Route path="borrows/new" element={<BorrowForm />} />
          <Route path="deposits" element={<DepositList />} />
          <Route path="damages" element={<DamageList />} />
          <Route path="damages/new" element={<DamageForm />} />
        </Route>
      </Routes>
    </Router>
  );
}
