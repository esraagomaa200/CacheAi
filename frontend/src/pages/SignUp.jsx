import SidebarSignUp from "../components/SidebarSignUp";
import SignupFormFields from "../components/SignupFormFields";

function SignUp() {
  return (
    <div className="flex min-h-screen bg-white">

      <SidebarSignUp />

      <main className="flex-1 overflow-y-auto px-8 pt-12 pb-8 lg:px-12 xl:px-16">
        <SignupFormFields />
      </main>

    </div>
  );
}

export default SignUp;