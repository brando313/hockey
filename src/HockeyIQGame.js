import React, { useEffect, useRef, useState } from "react";

export default function HockeyIQGame() {
  const canvasRef = useRef(null);

  const [score, setScore] = useState(0);
  const [oppScore, setOppScore] = useState(0);
  const [message, setMessage] = useState("Retrieve the puck, then attack.");

  const goalTypeRef = useRef("player");

  const player = useRef({ x: 120, y: 250, r: 10 });
  const puck = useRef({ x: 300, y: 250, r: 5, vx: 0, vy: 0 });

  const defenders = useRef([]);
  const oppGoalie = useRef({ x: 735, y: 250, r: 8 });
  const teamGoalie = useRef({ x: 65, y: 250, r: 9 });

  const hasPuck = useRef(false);
  const shotInFlight = useRef(false);

  const keys = useRef({});

  const GOAL_TOP = 205;
  const GOAL_BOTTOM = 295;

  useEffect(() => {
    defenders.current = Array.from({ length: 4 }).map(() => ({
      x: 450 + Math.random() * 200,
      y: 80 + Math.random() * 340,
      r: 11,
      hasPuck: false,
    }));

    const down = (e) => (keys.current[e.key] = true);
    const up = (e) => (keys.current[e.key] = false);

    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);

    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  useEffect(() => {
    const ctx = canvasRef.current.getContext("2d");

    const loop = () => {
      ctx.clearRect(0, 0, 800, 500);

      // rink
      ctx.fillStyle = "#eaf7ff";
      ctx.fillRect(0, 0, 800, 500);

      ctx.strokeStyle = "#d94c4c";
      ctx.strokeRect(742, GOAL_TOP, 26, GOAL_BOTTOM - GOAL_TOP);
      ctx.strokeRect(8, GOAL_TOP, 26, GOAL_BOTTOM - GOAL_TOP);

      // move player
      if (keys.current["ArrowUp"]) player.current.y -= 3;
      if (keys.current["ArrowDown"]) player.current.y += 3;
      if (keys.current["ArrowLeft"]) player.current.x -= 3;
      if (keys.current["ArrowRight"]) player.current.x += 3;

      // puck follows player
      if (hasPuck.current) {
        puck.current.x = player.current.x + 12;
        puck.current.y = player.current.y;
      }

      // shoot
      if (keys.current[" "] && hasPuck.current) {
        hasPuck.current = false;
        shotInFlight.current = true;

        const targetY = 220 + Math.random() * 50;

        puck.current.vx = 9;
        puck.current.vy = (targetY - puck.current.y) / 10;
      }

      // puck movement
      if (shotInFlight.current) {
        puck.current.x += puck.current.vx;
        puck.current.y += puck.current.vy;
      }

      // goalie tracking
      oppGoalie.current.y += (puck.current.y - oppGoalie.current.y) * 0.05;
      teamGoalie.current.y += (puck.current.y - teamGoalie.current.y) * 0.05;

      // opponent shooting
      defenders.current.forEach((d) => {
        if (d.hasPuck && d.x < 180) {
          d.hasPuck = false;
          puck.current.vx = -8;
          puck.current.vy = (250 - puck.current.y) / 10;
          shotInFlight.current = true;
        }
      });

      // goal detection (you score)
      if (
        puck.current.x > 742 &&
        puck.current.y > GOAL_TOP &&
        puck.current.y < GOAL_BOTTOM
      ) {
        goalTypeRef.current = "player";
        setScore((s) => s + 1);
        puck.current.x = 300;
        puck.current.y = 250;
        shotInFlight.current = false;
      }

      // opponent scores
      if (
        puck.current.x < 32 &&
        puck.current.y > GOAL_TOP &&
        puck.current.y < GOAL_BOTTOM
      ) {
        goalTypeRef.current = "opponent";
        setOppScore((s) => s + 1);
        puck.current.x = 300;
        puck.current.y = 250;
        shotInFlight.current = false;
      }

      // draw player
      ctx.fillStyle = "blue";
      ctx.beginPath();
      ctx.arc(player.current.x, player.current.y, player.current.r, 0, Math.PI * 2);
      ctx.fill();

      // draw defenders
      defenders.current.forEach((d) => {
        ctx.fillStyle = "green";
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fill();
      });

      // draw goalies
      ctx.fillStyle = "green";
      ctx.beginPath();
      ctx.arc(oppGoalie.current.x, oppGoalie.current.y, oppGoalie.current.r, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "blue";
      ctx.beginPath();
      ctx.arc(teamGoalie.current.x, teamGoalie.current.y, teamGoalie.current.r, 0, Math.PI * 2);
      ctx.fill();

      // draw puck
      ctx.fillStyle = "black";
      ctx.beginPath();
      ctx.arc(puck.current.x, puck.current.y, puck.current.r, 0, Math.PI * 2);
      ctx.fill();

      requestAnimationFrame(loop);
    };

    loop();
  }, []);

  return (
    <div style={{ textAlign: "center" }}>
      <h1>Hockey IQ Game</h1>
      <canvas ref={canvasRef} width={800} height={500} />
      <div>
        You: {score} | Opp: {oppScore}
      </div>
      <p>{message}</p>
    </div>
  );
}
