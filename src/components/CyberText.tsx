import { useState, useEffect } from "react";

export function CyberText({ text }: { text: string }) {
  const [displayText, setDisplayText] = useState("");
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789$+-*/=%\"'#&_(),.;:?!\\|{}<>[]^~";

  useEffect(() => {
    let iteration = 0;
    let animationFrame: number;

    const animate = () => {
      setDisplayText(() => 
        text
          .split("")
          .map((letter, index) => {
            if(index < iteration) {
              return text[index];
            }
            // Preserve spaces
            if (text[index] === " ") return " ";
            return letters[Math.floor(Math.random() * letters.length)];
          })
          .join("")
      );

      if(iteration >= text.length){
        cancelAnimationFrame(animationFrame);
      } else {
        iteration += 1 / 3; // Controls speed of decryption
        animationFrame = requestAnimationFrame(animate);
      }
    };
    animationFrame = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animationFrame);
  }, [text]);

  return <span className="font-mono">{displayText}</span>;
}
