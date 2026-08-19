import "./App.css";

import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import Home from "./pages/Home";
import Chat from "./pages/Chat";
import SignUp from "./pages/SignUp";
import EmergencyMode from "./pages/EmergencyMode";

import MainLayout from "./layout/MainLayout";
import Profile from "./pages/Profile";
import EditProfile from "./pages/EditProfile";
import EmergencyAuth from "./pages/EmergencyAuth";
import EmergencyHistory from "./pages/EmergencyHistory";
import Login from "./pages/Login";

function App() {
  return (
    <BrowserRouter>
      <Routes>

       
        <Route element={<MainLayout />}>
          <Route path="/" element={<Home />} />
        </Route>

        <Route path="/signup" element={<SignUp />} />
        <Route path="/login" element={<Login />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/edit-profile" element={<EditProfile />} />

        <Route path="/chat" element={<Chat />} />
        <Route path="/emergency-auth" element={<EmergencyAuth />} />

        <Route path="/emergency" element={<EmergencyMode />} />
        <Route path="/emergency-history" element={<EmergencyHistory />} />

        <Route path="*" element={<Navigate to="/" replace />} />

      </Routes>
    </BrowserRouter>
  );
}

export default App;