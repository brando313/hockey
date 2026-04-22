import React, { useEffect, useRef, useState } from "react";

export default function HockeyIQGame() {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const [score, setScore] = useState(0);
  const [oppScore, setOppScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [hasPuck, setHasPuck] = useState(false);
  const [message, setMessage] = useState("Retrieve the puck, battle, defend, and score.");
  const [battleMeter, setBattleMeter] = useState(0);
  const [stripMeter, setStripMeter] = useState(0);
  const [goalOverlay, setGoalOverlay] = useState(false);
  const [goalText, setGoalText] = useState("GOAL!");
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [forceTouchControls, setForceTouchControls] = useState(false);
  const [viewport, setViewport] = useState({ width: 900, scale: 1 });
  const goalOverlayRef = useRef(false);
  const goalTypeRef = useRef("player");

  const showTouchControls = isTouchDevice || forceTouchControls;

  const RINK_W = 800;
  const RINK_H = 500;
  const LEFT_GOAL_LINE_X = 32;
  const RIGHT_GOAL_LINE_X = 742;
  const GOAL_TOP = 205;
  const GOAL_BOTTOM = 295;

  const player = useRef({ x: 140, y: 250, radius: 10 });
  const puck = useRef({ x: 300, y: 250, radius: 6, vx: 0, vy: 0 });
  const defenders = useRef([]);
  const oppGoalie = useRef({ x: 735, y: 250, radius: 8, speed: 2.0 });
  const teamGoalie = useRef({ x: 65, y: 250, radius: 9, speed: 2.15 });
  const keys = useRef({});
  const animationRef = useRef(null);
  const hasPuckRef = useRef(false);
  const shootCooldown = useRef(0);
  const battlePresses = useRef(0);
  const enterLatch = useRef(false);
  const shootRequest = useRef(false);
  const shootBuffer = useRef(0);
  const pendingGoal = useRef(false);
  const shotInFlight = useRef(false);
  const stealTargetRef = useRef(null);
  const stripTargetRef = useRef(null);
  const stripMeterRef = useRef(0);
  const prevPlayer = useRef({ x: 140, y: 250 });
  const prevPuck = useRef({ x: 300, y: 250 });
  const moveInput = useRef({ x: 0, y: 0 });
  const defenderCarryTarget = useRef({ x: 220, y: 250, timer: 0 });
  const defenderShotCooldown = useRef(0);
  const battleTouchRef = useRef(false);
  const joystickTouchId = useRef(null);
  const joystickBaseRef = useRef(null);
  const battleDecayRef = useRef(null);

  const clearPossession = () => {
    defenders.current.forEach((d) => {
      d.hasPuck = false;
    });
    hasPuckRef.current = false;
    setHasPuck(false);
    shootRequest.current = false;
    pendingGoal.current = false;
    shotInFlight.current = false;
    stealTargetRef.current = null;
    stripTargetRef.current = null;
    stripMeterRef.current = 0;
    setStripMeter(0);
    battlePresses.current = 0;
    setBattleMeter(0);
  };

  const resetRound = (nextLevel = false) => {
    if (nextLevel) {
      setLevel((l) => l + 1);
    }
    player.current.x = 140;
    player.current.y = 250;
    puck.current.x = 240 + Math.random() * 200;
    puck.current.y = 100 + Math.random() * 300;
    prevPuck.current.x = puck.current.x;
    prevPuck.current.y = puck.current.y;
    puck.current.vx = 0;
    puck.current.vy = 0;
    oppGoalie.current.y = 250;
    teamGoalie.current.y = 250;
    defenderCarryTarget.current = { x: 220, y: 250, timer: 0 };
    defenderShotCooldown.current = 0;
    clearPossession();
    setMessage(
      showTouchControls
        ? "Two-way play. Win the puck, defend your net, and attack theirs."
        : "Two-way play. Win the puck, defend your net, and attack theirs."
    );
    setGoalOverlay(false);
    goalOverlayRef.current = false;
    setGoalText("GOAL!");
  };

  const spawnDefenders = (lvl) => {
    defenders.current = Array.from({ length: Math.min(5, lvl + 1) }).map((_, i) => ({
      x: 480 + Math.random() * 160,
      y: 70 + ((i * 110) % 340),
      radius: 11,
      speed: 1.15 + lvl * 0.18,
      hasPuck: false,
    }));
  };

  useEffect(() => {
    const detectTouch = () => {
      const touchCapable =
        typeof navigator !== "undefined" &&
        (
          (navigator.maxTouchPoints && navigator.maxTouchPoints > 0) ||
          (navigator.msMaxTouchPoints && navigator.msMaxTouchPoints > 0)
        );

      const touchEventSupport =
        typeof window !== "undefined" && "ontouchstart" in window;

      const coarsePointer =
        typeof window !== "undefined" &&
        typeof window.matchMedia === "function" &&
        window.matchMedia("(pointer: coarse)").matches;

      setIsTouchDevice(Boolean(touchCapable || touchEventSupport || coarsePointer));
    };

    const measure = () => {
      const width = wrapRef.current?.clientWidth || window.innerWidth || 900;
      const usable = Math.min(width - 16, 980);
      setViewport({ width: usable, scale: usable / RINK_W });
    };

    detectTouch();
    measure();

    const down = (e) => {
      const isSpace = e.code === "Space" || e.key === " " || e.key === "Spacebar";
      const isEnter = e.code === "Enter" || e.key === "Enter";
      const isArrow = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key);

      if (isArrow || isEnter || isSpace) e.preventDefault();

      keys.current[e.key] = true;
      if (isSpace) keys.current.Space = true;
      if (isEnter) keys.current.Enter = true;

      if (isEnter && !enterLatch.current && !hasPuckRef.current) {
        enterLatch.current = true;
        battlePresses.current += 1;
        setBattleMeter(Math.min(100, battlePresses.current * 12));
      }

      if (isSpace) {
        shootRequest.current = true;
        shootBuffer.current = 12;
      }
    };

    const up = (e) => {
      const isSpace = e.code === "Space" || e.key === " " || e.key === "Spacebar";
      const isEnter = e.code === "Enter" || e.key === "Enter";
      keys.current[e.key] = false;
      if (isSpace) keys.current.Space = false;
      if (isEnter) keys.current.Enter = false;
      if (isEnter) enterLatch.current = false;
    };

    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("resize", measure);
    window.addEventListener("orientationchange", measure);

    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("resize", measure);
      window.removeEventListener("orientationchange", measure);
    };
  }, []);

  useEffect(() => {
    spawnDefenders(level);
    resetRound(false);
  }, [level]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    let mounted = true;

    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

    const distance = (a, b) => {
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      return Math.sqrt(dx * dx + dy * dy);
    };

    const freezeAndAdvance = (text, scorer) => {
      goalTypeRef.current = scorer;
      setGoalText(text);
      setGoalOverlay(true);
      goalOverlayRef.current = true;
      setMessage(text);

      setTimeout(() => {
        if (!mounted) return;
        setGoalOverlay(false);
        goalOverlayRef.current = false;
        setGoalText("GOAL!");
        if (scorer === "player") {
          spawnDefenders(level + 1);
          resetRound(true);
        } else {
          spawnDefenders(level);
          resetRound(false);
        }
      }, 2000);
    };

    const movePlayer = () => {
      prevPlayer.current.x = player.current.x;
      prevPlayer.current.y = player.current.y;

      const speed = hasPuckRef.current ? 2.8 : 3.2;

      if (keys.current["ArrowUp"]) player.current.y -= speed;
      if (keys.current["ArrowDown"]) player.current.y += speed;
      if (keys.current["ArrowLeft"]) player.current.x -= speed;
      if (keys.current["ArrowRight"]) player.current.x += speed;

      if (moveInput.current.x !== 0 || moveInput.current.y !== 0) {
        player.current.x += moveInput.current.x * speed;
        player.current.y += moveInput.current.y * speed;
      }

      player.current.x = clamp(player.current.x, 20, 780);
      player.current.y = clamp(player.current.y, 20, 480);
    };

    const movePuck = () => {
      prevPuck.current.x = puck.current.x;
      prevPuck.current.y = puck.current.y;

      if (hasPuckRef.current) {
        puck.current.x = player.current.x + 13;
        puck.current.y = player.current.y;
        puck.current.vx = 0;
        puck.current.vy = 0;
        return;
      }

      const puckCarrier = defenders.current.find((d) => d.hasPuck);
      if (puckCarrier) {
        puck.current.x = puckCarrier.x - 10;
        puck.current.y = puckCarrier.y;
        puck.current.vx = 0;
        puck.current.vy = 0;
        return;
      }

      puck.current.x += puck.current.vx;
      puck.current.y += puck.current.vy;

      const friction = shotInFlight.current ? 0.996 : 0.985;
      puck.current.vx *= friction;
      puck.current.vy *= friction;

      if (puck.current.x < 18 || puck.current.x > 782) {
        puck.current.vx *= -0.9;
        if (shotInFlight.current && (puck.current.x > 782 || puck.current.x < 18)) {
          shotInFlight.current = false;
          shootCooldown.current = 0;
          if (!pendingGoal.current) setMessage("Missed. Play the rebound.");
        }
      }
      if (puck.current.y < 18 || puck.current.y > 482) puck.current.vy *= -0.9;

      puck.current.x = clamp(puck.current.x, 18, 782);
      puck.current.y = clamp(puck.current.y, 18, 482);
    };

    const drawRink = () => {
      ctx.fillStyle = "#eaf7ff";
      ctx.fillRect(0, 0, RINK_W, RINK_H);

      ctx.strokeStyle = "#6da9cf";
      ctx.lineWidth = 2;
      ctx.strokeRect(10, 10, 780, 480);
      ctx.beginPath();
      ctx.moveTo(400, 10);
      ctx.lineTo(400, 490);
      ctx.stroke();

      ctx.strokeStyle = "#d94c4c";
      ctx.lineWidth = 3;
      ctx.strokeRect(RIGHT_GOAL_LINE_X, GOAL_TOP, 26, GOAL_BOTTOM - GOAL_TOP);
      ctx.strokeRect(LEFT_GOAL_LINE_X - 8, GOAL_TOP, 26, GOAL_BOTTOM - GOAL_TOP);

      ctx.fillStyle = "rgba(255,0,0,0.08)";
      ctx.fillRect(RIGHT_GOAL_LINE_X - 2, GOAL_TOP - 10, 35, GOAL_BOTTOM - GOAL_TOP + 20);
      ctx.fillRect(LEFT_GOAL_LINE_X - 16, GOAL_TOP - 10, 35, GOAL_BOTTOM - GOAL_TOP + 20);
    };

    const drawObjects = () => {
      ctx.fillStyle = "#1d4ed8";
      ctx.beginPath();
      ctx.arc(player.current.x, player.current.y, player.current.radius, 0, Math.PI * 2);
      ctx.fill();

      defenders.current.forEach((d) => {
        ctx.fillStyle = "#15803d";
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.radius, 0, Math.PI * 2);
        ctx.fill();
      });

      ctx.fillStyle = "#1d4ed8";
      ctx.beginPath();
      ctx.arc(teamGoalie.current.x, teamGoalie.current.y, teamGoalie.current.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#15803d";
      ctx.beginPath();
      ctx.arc(oppGoalie.current.x, oppGoalie.current.y, oppGoalie.current.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#111827";
      ctx.beginPath();
      ctx.arc(puck.current.x, puck.current.y, puck.current.radius, 0, Math.PI * 2);
      ctx.fill();

      if (goalOverlayRef.current) {
        const isOpponentGoal = goalTypeRef.current === "opponent";
        ctx.fillStyle = isOpponentGoal
          ? "rgba(220, 38, 38, 0.28)"
          : "rgba(22, 163, 74, 0.22)";
        ctx.fillRect(0, 0, RINK_W, RINK_H);

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 60px Arial";
        ctx.textAlign = "center";
        ctx.fillText(goalText, RINK_W / 2, RINK_H / 2);
        ctx.textAlign = "start";
      }
    };

    const updateGoalies = () => {
      const targetYOpp = hasPuckRef.current ? player.current.y : puck.current.y;
      const dyOpp = targetYOpp - oppGoalie.current.y;
      oppGoalie.current.y += Math.sign(dyOpp) * Math.min(Math.abs(dyOpp) * 0.6, oppGoalie.current.speed);
      oppGoalie.current.y = clamp(oppGoalie.current.y, 215, 285);

      const carrier = defenders.current.find((d) => d.hasPuck);
      const targetYHome = carrier ? carrier.y : puck.current.y;
      const dyHome = targetYHome - teamGoalie.current.y;
      teamGoalie.current.y += Math.sign(dyHome) * Math.min(Math.abs(dyHome) * 0.62, teamGoalie.current.speed);
      teamGoalie.current.y = clamp(teamGoalie.current.y, 215, 285);

      const oppSave =
        distance(puck.current, oppGoalie.current) <
        oppGoalie.current.radius + puck.current.radius + 2;

      if (oppSave && shotInFlight.current && puck.current.vx > 0) {
        const centerBias =
          Math.abs(puck.current.y - oppGoalie.current.y) <
          oppGoalie.current.radius * 0.7;
        const saveChance = centerBias ? 0.5 : 0.15;
        if (Math.random() < saveChance) {
          puck.current.vx *= -0.45;
          puck.current.vy += (Math.random() - 0.5) * 3;
          shotInFlight.current = false;
          setMessage("Saved. Find the rebound.");
        }
      }

      const homeSave =
        distance(puck.current, teamGoalie.current) <
        teamGoalie.current.radius + puck.current.radius + 2;

      if (homeSave && !hasPuckRef.current && defenders.current.find((d) => d.hasPuck) && puck.current.x < 140) {
        puck.current.vx = 2.8 + Math.random() * 2;
        puck.current.vy = (Math.random() - 0.5) * 3;
        defenders.current.forEach((d) => {
          d.hasPuck = false;
        });
        setMessage("Your goalie made the save. Recover the rebound.");
      }
    };

    const updateDefenders = () => {
      const puckPos = hasPuckRef.current ? player.current : puck.current;
      let defenderWithPuck = defenders.current.find((d) => d.hasPuck);

      if (!hasPuckRef.current && !defenderWithPuck && !shotInFlight.current) {
        const nearby = defenders.current
          .filter((d) => distance(d, puck.current) < 18)
          .sort((a, b) => distance(a, puck.current) - distance(b, puck.current));

        if (nearby.length > 0) {
          defenders.current.forEach((d) => {
            d.hasPuck = false;
          });
          nearby[0].hasPuck = true;
          defenderWithPuck = nearby[0];
          defenderCarryTarget.current = {
            x: 120 + Math.random() * 120,
            y: 100 + Math.random() * 300,
            timer: 90,
          };
          setMessage("Opposition recovered the puck. Defend your net.");
        }
      }

      if (defenderWithPuck) {
        const nearHomeNet = defenderWithPuck.x < 165;
        const insideLane = defenderWithPuck.y > 170 && defenderWithPuck.y < 330;
        const openToShoot = distance(defenderWithPuck, player.current) > 26;

        if (
          nearHomeNet &&
          insideLane &&
          openToShoot &&
          defenderShotCooldown.current <= 0 &&
          !goalOverlayRef.current
        ) {
          defenders.current.forEach((d) => {
            d.hasPuck = false;
          });

          const targetY = 222 + Math.random() * 56;
          const shotDx = 8 - defenderWithPuck.x;
          const shotDy = targetY - defenderWithPuck.y;
          const shotLen = Math.sqrt(shotDx * shotDx + shotDy * shotDy) || 1;

          puck.current.x = defenderWithPuck.x - 14;
          puck.current.y = defenderWithPuck.y;
          prevPuck.current.x = puck.current.x;
          prevPuck.current.y = puck.current.y;
          puck.current.vx = (shotDx / shotLen) * 8.8;
          puck.current.vy = (shotDy / shotLen) * 8.8;
          shotInFlight.current = true;
          pendingGoal.current = true;
          defenderShotCooldown.current = 80;
          setMessage("Opposition shoots. Defend the rebound.");
          return;
        }

        if (
          defenderCarryTarget.current.timer <= 0 ||
          distance(defenderWithPuck, defenderCarryTarget.current) < 24
        ) {
          defenderCarryTarget.current = {
            x: defenderWithPuck.x > 190 ? 110 + Math.random() * 80 : 90 + Math.random() * 55,
            y: 110 + Math.random() * 280,
            timer: 70 + Math.floor(Math.random() * 35),
          };
        } else {
          defenderCarryTarget.current.timer -= 1;
        }

        defenders.current.forEach((d, idx) => {
          let tx;
          let ty;
          let speedMult;

          if (d.hasPuck) {
            tx = defenderCarryTarget.current.x;
            ty = defenderCarryTarget.current.y;
            speedMult = 0.9;
          } else {
            const laneOffsetX = -34 - (idx % 2) * 24;
            const laneOffsetY = (idx % 3 - 1) * 54;
            tx = defenderWithPuck.x + laneOffsetX;
            ty = defenderWithPuck.y + laneOffsetY;
            speedMult = 0.52;
          }

          const dx = tx - d.x;
          const dy = ty - d.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          d.x += (dx / dist) * d.speed * speedMult;
          d.y += (dy / dist) * d.speed * speedMult;
          d.x = clamp(d.x, 18, 782);
          d.y = clamp(d.y, 18, 482);
        });
        return;
      }

      const withDist = defenders.current.map((d, i) => ({ i, d, dist: distance(d, puckPos) }));
      withDist.sort((a, b) => a.dist - b.dist);
      const engageCount = Math.min(2, defenders.current.length);

      const repulsion = (d, others) => {
        let rx = 0;
        let ry = 0;
        others.forEach((o) => {
          if (o === d) return;
          const dx = d.x - o.x;
          const dy = d.y - o.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          if (dist < 40) {
            rx += (dx / dist) * (40 - dist) * 0.05;
            ry += (dy / dist) * (40 - dist) * 0.05;
          }
        });
        return { rx, ry };
      };

      defenders.current.forEach((d, idx) => {
        d.hasPuck = false;
        const isEngager = withDist.slice(0, engageCount).some((w) => w.i === idx);
        let tx;
        let ty;
        let speedMult;

        if (isEngager) {
          const dx = puckPos.x - d.x;
          const dy = puckPos.y - d.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          tx = d.x + (dx / dist) * d.speed * 0.75;
          ty = d.y + (dy / dist) * d.speed * 0.55;
          speedMult = 1.0;
        } else {
          const goalX = RIGHT_GOAL_LINE_X;
          const goalY = 250;
          const midX = (puckPos.x + goalX) / 2;
          const midY = (puckPos.y + goalY) / 2;
          const offset = (idx % 3 - 1) * 70;
          tx = midX - 40;
          ty = midY + offset;
          speedMult = 0.6;
        }

        const dx2 = tx - d.x;
        const dy2 = ty - d.y;
        const dist2 = Math.sqrt(dx2 * dx2 + dy2 * dy2) || 1;
        d.x += (dx2 / dist2) * d.speed * speedMult;
        d.y += (dy2 / dist2) * d.speed * speedMult;
        const { rx, ry } = repulsion(d, defenders.current);
        d.x += rx;
        d.y += ry;
        d.x = clamp(d.x, 18, 782);
        d.y = clamp(d.y, 18, 482);
      });
    };

    const attemptBattle = () => {
      const defenderWithPuck = defenders.current.find((d) => d.hasPuck);

      if (defenderWithPuck) {
        const inContact =
          distance(player.current, defenderWithPuck) <
          player.current.radius + defenderWithPuck.radius + 6;

        if (inContact) {
          if (stealTargetRef.current !== defenderWithPuck) {
            stealTargetRef.current = defenderWithPuck;
            battlePresses.current = Math.min(battlePresses.current, 1);
          }

          const requiredPresses = 5;
          setMessage(
            showTouchControls
              ? "Stay on the puck carrier. Hold Battle in contact to steal it."
              : "Stay on the puck carrier. Keep pressing Enter while in contact to steal it."
          );
          setBattleMeter(Math.min(100, (battlePresses.current / requiredPresses) * 100));

          if (battlePresses.current >= requiredPresses) {
            defenders.current.forEach((d) => {
              d.hasPuck = false;
            });
            setHasPuck(true);
            hasPuckRef.current = true;
            shootRequest.current = false;
            battlePresses.current = 0;
            stealTargetRef.current = null;
            stripTargetRef.current = null;
            stripMeterRef.current = 0;
            setStripMeter(0);
            setBattleMeter(0);
            setMessage("Turnover won. Attack.");
          }
        } else {
          if (stealTargetRef.current === defenderWithPuck || battlePresses.current > 0) {
            battlePresses.current = Math.max(0, battlePresses.current - 0.2);
            setBattleMeter(Math.min(100, (battlePresses.current / 7) * 100));
            setMessage(
              showTouchControls
                ? "Re-engage and hold Battle on the puck carrier."
                : "Re-engage the puck carrier and keep pressing Enter in contact."
            );
          }
          stealTargetRef.current = null;
        }
        return;
      }

      stealTargetRef.current = null;
      if (hasPuckRef.current || shotInFlight.current) return;

      const nearPuck = distance(player.current, puck.current) < 28;
      if (!nearPuck) {
        if (battlePresses.current > 0) {
          battlePresses.current = Math.max(0, battlePresses.current - 0.08);
          setBattleMeter(Math.min(100, battlePresses.current * 12));
        }
        return;
      }

      const nearbyDefenders = defenders.current.filter((d) => distance(d, puck.current) < 36);
      const inBattle = nearbyDefenders.length > 0;

      if (!inBattle) {
        setHasPuck(true);
        hasPuckRef.current = true;
        stripTargetRef.current = null;
        stripMeterRef.current = 0;
        setStripMeter(0);
        shootRequest.current = false;
        battlePresses.current = 0;
        setBattleMeter(0);
        setMessage("Clean pickup. Attack and shoot.");
        return;
      }

      const requiredPresses = Math.max(3, Math.floor((4 + nearbyDefenders.length * 3) * 0.66));
      setMessage(
        showTouchControls
          ? "Battle at the puck. Hold Battle to win it."
          : "Battle at the puck. Keep tapping Enter to win it."
      );

      if (battlePresses.current >= requiredPresses) {
        setHasPuck(true);
        hasPuckRef.current = true;
        stripTargetRef.current = null;
        stripMeterRef.current = 0;
        setStripMeter(0);
        shootRequest.current = false;
        battlePresses.current = 0;
        setBattleMeter(100);
        setTimeout(() => setBattleMeter(0), 120);
        setMessage("Battle won. Attack quickly.");
      } else {
        setBattleMeter(Math.min(100, (battlePresses.current / requiredPresses) * 100));
      }
    };

    const attemptShot = () => {
      if (!hasPuckRef.current || shootCooldown.current > 0) return;
      if (!shootRequest.current && shootBuffer.current <= 0) return;

      shootRequest.current = false;
      shootBuffer.current = 0;
      shootCooldown.current = 20;
      clearPossession();

      const inSlot = player.current.x > 540 && player.current.y > 170 && player.current.y < 330;
      const traffic = defenders.current.filter(
        (d) => d.x > player.current.x && distance(d, player.current) < 120
      ).length;
      const lateralDistanceFromGoalie = player.current.y - oppGoalie.current.y;
      const angleBias = Math.min(1, Math.abs(lateralDistanceFromGoalie) / 90);
      const shotQuality = ((inSlot ? 0.68 : 0.32) - traffic * 0.12 + angleBias * 0.12) * 1.45;
      const isGoalShot = Math.random() < Math.max(0.1, Math.min(0.92, shotQuality));

      const goalieTop = oppGoalie.current.y - oppGoalie.current.radius - 8;
      const goalieBottom = oppGoalie.current.y + oppGoalie.current.radius + 8;
      const nearSidePreference = lateralDistanceFromGoalie >= 0 ? 1 : -1;

      let targetY;
      if (isGoalShot) {
        const cornerChoice = Math.random();
        if (cornerChoice < 0.4) targetY = 212 + Math.random() * 18;
        else if (cornerChoice < 0.8) targetY = 270 + Math.random() * 18;
        else {
          const edgeOffset = nearSidePreference > 0 ? 24 : -24;
          targetY = clamp(
            oppGoalie.current.y + edgeOffset + (Math.random() * 18 - 9),
            210,
            290
          );
        }
        if (targetY > goalieTop && targetY < goalieBottom) {
          targetY = nearSidePreference > 0 ? 282 + Math.random() * 8 : 210 + Math.random() * 8;
        }
      } else {
        targetY = Math.random() < 0.5 ? 110 + Math.random() * 60 : 330 + Math.random() * 60;
      }

      const releaseYOffset =
        (Math.random() * 10 - 5) + Math.sign(lateralDistanceFromGoalie || 1) * 4;
      const releaseXOffset = 20 + Math.random() * 8;
      const shotDx = 780 - (player.current.x + releaseXOffset);
      const shotDy = targetY - (player.current.y + releaseYOffset);
      const shotLen = Math.sqrt(shotDx * shotDx + shotDy * shotDy) || 1;
      const baseSpeed = 9.5 + Math.random() * 1.8;

      puck.current.x = player.current.x + releaseXOffset;
      puck.current.y = player.current.y + releaseYOffset;
      prevPuck.current.x = puck.current.x;
      prevPuck.current.y = puck.current.y;
      puck.current.vx = (shotDx / shotLen) * baseSpeed;
      puck.current.vy = (shotDy / shotLen) * baseSpeed;
      shotInFlight.current = true;
      pendingGoal.current = isGoalShot;

      setMessage(
        isGoalShot
          ? angleBias > 0.35
            ? "Shot away with angle."
            : "Shot away."
          : "Shot away. Chase the rebound if it misses."
      );
    };

    const checkTurnovers = () => {
      defenders.current.forEach((d) => {
        const dx = player.current.x - d.x;
        const dy = player.current.y - d.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const minDist = player.current.radius + d.radius;

        if (dist < minDist) {
          const overlap = minDist - dist;
          const nx = dx / dist;
          const ny = dy / dist;
          const playerPush = hasPuckRef.current ? 0.36 : 0.7;
          const defenderPush = hasPuckRef.current ? 0.18 : 0.3;

          player.current.x = clamp(player.current.x + nx * overlap * playerPush, 20, 780);
          player.current.y = clamp(player.current.y + ny * overlap * playerPush, 20, 480);
          d.x = clamp(d.x - nx * overlap * defenderPush, 18, 782);
          d.y = clamp(d.y - ny * overlap * defenderPush, 18, 482);

          if (hasPuckRef.current) setMessage("Heavy contact. Protect it or move it.");
          else if (distance(player.current, puck.current) < 30) {
            setMessage(
              showTouchControls
                ? "Stay on it. Hold Battle to win the puck."
                : "Stay on it. Keep hammering Enter to win the puck battle."
            );
          }
        }
      });
    };

    const checkDefenderSteal = () => {
      if (!hasPuckRef.current || shotInFlight.current) {
        stripTargetRef.current = null;
        stripMeterRef.current = Math.max(0, stripMeterRef.current - 3.2);
        setStripMeter(stripMeterRef.current);
        return;
      }

      const pressureRadius = player.current.radius + 12;
      const touching = defenders.current.filter(
        (d) => distance(player.current, d) < pressureRadius + d.radius
      );

      if (touching.length === 0) {
        stripTargetRef.current = null;
        stripMeterRef.current = Math.max(0, stripMeterRef.current - 2.8);
        setStripMeter(stripMeterRef.current);
        return;
      }

      const primary = touching
        .slice()
        .sort((a, b) => distance(a, player.current) - distance(b, player.current))[0];

      stripTargetRef.current = primary;

      const playerMove = Math.sqrt(
        Math.pow(player.current.x - prevPlayer.current.x, 2) +
          Math.pow(player.current.y - prevPlayer.current.y, 2)
      );
      const pinnedBonus =
        player.current.x > 730 || player.current.y < 30 || player.current.y > 470 ? 0.45 : 0;
      const movementPenalty = playerMove > 2.8 ? 1.35 : playerMove > 1.6 ? 0.7 : 0.15;
      const gain = Math.max(0.18, 0.75 + touching.length * 0.45 + pinnedBonus - movementPenalty);

      stripMeterRef.current = Math.max(0, Math.min(100, stripMeterRef.current + gain));
      setStripMeter(stripMeterRef.current);

      if (stripMeterRef.current > 18) setMessage("Protect the puck. You are getting tied up.");

      if (stripMeterRef.current >= 100 && stripTargetRef.current) {
        const thief = stripTargetRef.current;
        defenders.current.forEach((d) => {
          d.hasPuck = false;
        });
        thief.hasPuck = true;
        defenderCarryTarget.current = {
          x: 180 + Math.random() * 120,
          y: 100 + Math.random() * 300,
          timer: 90,
        };
        clearPossession();
        thief.hasPuck = true;
        setMessage("Stripped. Get back on the puck carrier.");
      }
    };

    const checkGoals = () => {
      const rightCrossed = prevPuck.current.x < RIGHT_GOAL_LINE_X && puck.current.x >= RIGHT_GOAL_LINE_X;
      const rightYAtCross =
        puck.current.x !== prevPuck.current.x
          ? prevPuck.current.y +
            ((RIGHT_GOAL_LINE_X - prevPuck.current.x) *
              (puck.current.y - prevPuck.current.y)) /
              (puck.current.x - prevPuck.current.x)
          : puck.current.y;

      const rightGoal =
        (rightCrossed && rightYAtCross >= GOAL_TOP && rightYAtCross <= GOAL_BOTTOM) ||
        (puck.current.x >= RIGHT_GOAL_LINE_X &&
          puck.current.y >= GOAL_TOP &&
          puck.current.y <= GOAL_BOTTOM);

      const leftCrossed = prevPuck.current.x > LEFT_GOAL_LINE_X && puck.current.x <= LEFT_GOAL_LINE_X;
      const leftYAtCross =
        puck.current.x !== prevPuck.current.x
          ? prevPuck.current.y +
            ((LEFT_GOAL_LINE_X - prevPuck.current.x) *
              (puck.current.y - prevPuck.current.y)) /
              (puck.current.x - prevPuck.current.x)
          : puck.current.y;

      const leftGoal =
        (leftCrossed && leftYAtCross >= GOAL_TOP && leftYAtCross <= GOAL_BOTTOM) ||
        (puck.current.x <= LEFT_GOAL_LINE_X &&
          puck.current.y >= GOAL_TOP &&
          puck.current.y <= GOAL_BOTTOM);

      if ((rightGoal && (shotInFlight.current || hasPuckRef.current)) && !goalOverlayRef.current) {
        puck.current.vx = 0;
        puck.current.vy = 0;
        setScore((s) => s + 1);
        freezeAndAdvance("GOAL!", "player");
        return;
      }

      const defenderCarrier = defenders.current.find((d) => d.hasPuck);
      if ((leftGoal && (defenderCarrier || shotInFlight.current)) && !goalOverlayRef.current) {
        puck.current.vx = 0;
        puck.current.vy = 0;
        setOppScore((s) => s + 1);
        freezeAndAdvance("OPPONENT SCORES", "opponent");
      }
    };

    const loop = () => {
      if (!mounted) return;
      ctx.clearRect(0, 0, RINK_W, RINK_H);

      if (goalOverlayRef.current) {
        drawRink();
        drawObjects();
        animationRef.current = requestAnimationFrame(loop);
        return;
      }

      if (shootCooldown.current > 0) shootCooldown.current -= 1;
      if (defenderShotCooldown.current > 0) defenderShotCooldown.current -= 1;
      if (shootBuffer.current > 0) shootBuffer.current -= 1;
      if (!hasPuckRef.current && battlePresses.current > 0) {
        battlePresses.current = Math.max(0, battlePresses.current - 0.01);
      }

      movePlayer();
      movePuck();
      updateDefenders();
      updateGoalies();
      attemptBattle();
      attemptShot();
      checkTurnovers();
      checkDefenderSteal();
      checkGoals();

      drawRink();
      drawObjects();

      animationRef.current = requestAnimationFrame(loop);
    };

    loop();

    return () => {
      mounted = false;
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [level, showTouchControls]);

  const startBattleTouch = () => {
    if (hasPuckRef.current) return;
    battleTouchRef.current = true;
    battlePresses.current += 1;
    setBattleMeter(Math.min(100, battlePresses.current * 12));
    if (battleDecayRef.current) clearInterval(battleDecayRef.current);
    battleDecayRef.current = setInterval(() => {
      if (!battleTouchRef.current || hasPuckRef.current) return;
      battlePresses.current += 1;
      setBattleMeter(Math.min(100, battlePresses.current * 12));
    }, 90);
  };

  const stopBattleTouch = () => {
    battleTouchRef.current = false;
    if (battleDecayRef.current) {
      clearInterval(battleDecayRef.current);
      battleDecayRef.current = null;
    }
  };

  const shootTouch = () => {
    if (hasPuckRef.current) {
      shootRequest.current = true;
      shootBuffer.current = 12;
    }
  };

  const updateJoystickFromTouch = (touch) => {
    const base = joystickBaseRef.current;
    if (!base) return;
    const rect = base.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const dx = touch.clientX - centerX;
    const dy = touch.clientY - centerY;
    const max = rect.width / 2;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const clamped = Math.min(dist, max);
    moveInput.current = {
      x: (dx / dist) * (clamped / max),
      y: (dy / dist) * (clamped / max),
    };
  };

  const handleJoystickStart = (e) => {
    const touch = e.changedTouches[0];
    joystickTouchId.current = touch.identifier;
    updateJoystickFromTouch(touch);
  };

  const handleJoystickMove = (e) => {
    const touch = Array.from(e.changedTouches).find(
      (t) => t.identifier === joystickTouchId.current
    );
    if (touch) updateJoystickFromTouch(touch);
  };

  const handleJoystickEnd = (e) => {
    const touch = Array.from(e.changedTouches).find(
      (t) => t.identifier === joystickTouchId.current
    );
    if (touch) {
      joystickTouchId.current = null;
      moveInput.current = { x: 0, y: 0 };
    }
  };

  const joystickSize = showTouchControls ? 160 : 140;
  const actionSize = showTouchControls ? 120 : 110;
  const stickSize = showTouchControls ? 64 : 56;

  return (
    <div
      ref={wrapRef}
      style={{
        textAlign: "center",
        padding: showTouchControls ? 12 : 20,
        fontFamily: "Arial, sans-serif",
        touchAction: "none",
        minHeight: "100vh",
        background: "linear-gradient(180deg, #f8fbff 0%, #eef6ff 100%)",
        boxSizing: "border-box",
      }}
    >
      <h1
        style={{
          margin: showTouchControls ? "0 0 8px" : "0 0 12px",
          fontSize: showTouchControls ? 28 : 32,
        }}
      >
        Hockey IQ Game
      </h1>

      <div
        style={{
          width: viewport.width,
          maxWidth: "100%",
          margin: "0 auto",
          background: "white",
          borderRadius: 18,
          boxShadow: "0 8px 24px rgba(15,23,42,0.08)",
          padding: showTouchControls ? 10 : 14,
          boxSizing: "border-box",
        }}
      >
        <canvas
          ref={canvasRef}
          width={RINK_W}
          height={RINK_H}
          style={{
            width: "100%",
            height: "auto",
            aspectRatio: `${RINK_W} / ${RINK_H}`,
            border: "1px solid #cbd5e1",
            borderRadius: 12,
            background: "white",
            display: "block",
          }}
        />

        <div
          style={{
            marginTop: 10,
            fontSize: showTouchControls ? 18 : 16,
            fontWeight: 700,
          }}
        >
          <strong>You:</strong> {score} &nbsp; | &nbsp;
          <strong>Opp:</strong> {oppScore} &nbsp; | &nbsp;
          <strong>Level:</strong> {level} &nbsp; | &nbsp;
          <strong>Puck:</strong> {hasPuck ? "Controlled" : "Loose"}
        </div>

        <div
          style={{
            width: "100%",
            maxWidth: 420,
            height: 14,
            margin: "10px auto 0",
            background: "#d1d5db",
            borderRadius: 9999,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${battleMeter}%`,
              height: "100%",
              background: hasPuck ? "#2563eb" : "#16a34a",
              transition: "width 0.08s linear",
            }}
          />
        </div>

        <div
          style={{
            width: "100%",
            maxWidth: 420,
            height: 10,
            margin: "8px auto 0",
            background: "#e5e7eb",
            borderRadius: 9999,
            overflow: "hidden",
            opacity: hasPuck || stripMeter > 0 ? 1 : 0.35,
          }}
        >
          <div
            style={{
              width: `${stripMeter}%`,
              height: "100%",
              background: "#dc2626",
              transition: "width 0.08s linear",
            }}
          />
        </div>

        <p
          style={{
            marginTop: 10,
            fontWeight: 700,
            fontSize: showTouchControls ? 18 : 16,
            minHeight: 28,
          }}
        >
          {message}
        </p>

        <p
          style={{
            color: "#4b5563",
            margin: "4px 0 0",
            fontSize: showTouchControls ? 16 : 14,
          }}
        >
          {showTouchControls ? (
            <>
              Left thumb skates. Hold <strong>Battle</strong> in contact to win the
              scrum. Tap <strong>Shoot</strong> when you have the puck. Defend the
              left net and attack the right net.
            </>
          ) : (
            <>
              Arrow keys to skate. Tap <strong>Enter</strong> to win battles and{" "}
              <strong>Space</strong> to shoot. Defend the left net and attack the
              right net.
            </>
          )}
        </p>
      </div>

      <div style={{ marginTop: 10 }}>
        <button
          onClick={() => setForceTouchControls((v) => !v)}
          style={{
            border: "1px solid #cbd5e1",
            background: forceTouchControls ? "#dbeafe" : "white",
            color: "#0f172a",
            borderRadius: 9999,
            padding: "8px 14px",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          {forceTouchControls ? "Hide Touch Controls" : "Show Touch Controls"}
        </button>
      </div>

      {showTouchControls && (
        <div
          style={{
            width: viewport.width,
            maxWidth: "100%",
            margin: "14px auto 0",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            gap: 14,
          }}
        >
          <div
            ref={joystickBaseRef}
            onTouchStart={handleJoystickStart}
            onTouchMove={handleJoystickMove}
            onTouchEnd={handleJoystickEnd}
            onTouchCancel={handleJoystickEnd}
            style={{
              width: joystickSize,
              height: joystickSize,
              borderRadius: "50%",
              background: "rgba(107,114,128,0.16)",
              border: "2px solid rgba(107,114,128,0.25)",
              position: "relative",
              flexShrink: 0,
              userSelect: "none",
              WebkitUserSelect: "none",
              WebkitTouchCallout: "none",
            }}
          >
            <div
              style={{
                width: stickSize,
                height: stickSize,
                borderRadius: "50%",
                background: "rgba(37,99,235,0.65)",
                position: "absolute",
                left: `calc(50% - ${stickSize / 2}px + ${moveInput.current.x * 40}px)`,
                top: `calc(50% - ${stickSize / 2}px + ${moveInput.current.y * 40}px)`,
                transition: joystickTouchId.current === null ? "all 0.12s ease-out" : "none",
                boxShadow: "0 4px 10px rgba(37,99,235,0.25)",
              }}
            />
          </div>

          <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
            <button
              onTouchStart={startBattleTouch}
              onTouchEnd={stopBattleTouch}
              onTouchCancel={stopBattleTouch}
              style={{
                width: actionSize,
                height: actionSize,
                borderRadius: "50%",
                border: "none",
                background: "#16a34a",
                color: "white",
                fontSize: 24,
                fontWeight: 800,
                boxShadow: "0 8px 18px rgba(22,163,74,0.25)",
                touchAction: "manipulation",
              }}
            >
              Battle
            </button>
            <button
              onTouchStart={shootTouch}
              style={{
                width: actionSize,
                height: actionSize,
                borderRadius: "50%",
                border: "none",
                background: "#2563eb",
                color: "white",
                fontSize: 24,
                fontWeight: 800,
                boxShadow: "0 8px 18px rgba(37,99,235,0.25)",
                touchAction: "manipulation",
              }}
            >
              Shoot
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
