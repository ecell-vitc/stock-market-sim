import { useState } from "react";
import Greet from "./greet";
import Login from "./login";
import Signup from "./signup";

const AuthPage = () => {
  const [isSignup, setIsSignup] = useState(false);

  return (
    <div className="min-h-screen w-full relative overflow-hidden">
      
      {/* Stars */}
      <div className="absolute inset-0 bg-[radial-gradient(white_1px,transparent_1px)] [background-size:40px_40px] opacity-10" />

      <div className="relative z-10 grid grid-cols-2 h-screen">
        {/* Left */}
        <Greet />

        {/* Right */}
        <div className="flex items-center justify-center">
          {isSignup ? (
            <Signup onSwitch={() => setIsSignup(false)} />
          ) : (
            <Login onSwitch={() => setIsSignup(true)} />
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
