import SidebarSignUp from "../components/SidebarSignUp";
import SignupFormFields from "../components/SignupFormFields";
import AppearanceControls from "../components/AppearanceControls";

function SignUp() {
  return (
    <div className="relative flex min-h-screen bg-white">
      <SidebarSignUp />

      <main className="flex-1 overflow-y-auto px-4 pb-8 pt-5 sm:px-8 sm:pt-12 lg:px-12 xl:px-16">
        <div className="mb-4 flex justify-end sm:absolute sm:right-5 sm:top-5 sm:z-20 sm:mb-0">
          <AppearanceControls compact />
        </div>

        <SignupFormFields />
      </main>

    </div>
  );
}

export default SignUp;
