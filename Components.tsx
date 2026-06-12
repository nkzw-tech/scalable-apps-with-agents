import JSConfettiModule from "js-confetti";
import {
  ElementType,
  ReactNode,
  startTransition,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { motion, useInView } from "framer-motion";
import LiquidGlass from "@nkzw/liquid-glass";
import Logo from "./Logo.tsx";
import QRCode from "./QRCode.tsx";
import FunDemoQRCode from "./FunDemoQRCode.tsx";

const LOCATION_CHANGE_EVENT = "void:slide-location-change";
const POLL_INTERVAL_MS = 1_000;
const CELEBRATION_THRESHOLD = 5;

type JSConfettiInstance = {
  addConfetti: (config?: {
    confettiColors?: Array<string>;
    confettiNumber?: number;
    emojis?: Array<string>;
    emojiSize?: number;
  }) => Promise<void>;
};

const JSConfetti = JSConfettiModule as unknown as new () => JSConfettiInstance;

let historyEventsInstalled = false;
let jsConfetti: JSConfettiInstance | null = null;

const Visible = ({ children }: { children: ReactNode }) => {
  const ref = useRef<HTMLDivElement>(null);
  const isVisible = useInView(ref);

  return (
    <>
      <div
        ref={ref}
        style={{
          inset: 10,
          pointerEvents: "none",
          position: "absolute",
        }}
      />
      {isVisible && children}
    </>
  );
};

const getActiveSlideId = () => {
  if (typeof window === "undefined") {
    return 0;
  }

  const slideIndex = Number(new URLSearchParams(window.location.search).get("slideIndex") ?? "0");
  return Number.isInteger(slideIndex) && slideIndex >= 0 ? slideIndex : 0;
};

const installHistoryEvents = () => {
  if (typeof window === "undefined" || historyEventsInstalled) {
    return;
  }

  const dispatchLocationChange = () => {
    window.dispatchEvent(new Event(LOCATION_CHANGE_EVENT));
  };

  for (const method of ["pushState", "replaceState"] as const) {
    const original = window.history[method];
    window.history[method] = ((data: unknown, unused: string, url?: string | URL | null) => {
      const result = original.call(window.history, data, unused, url);
      dispatchLocationChange();
      return result;
    }) as History[typeof method];
  }

  window.addEventListener("popstate", dispatchLocationChange);
  historyEventsInstalled = true;
};

const getSlideCount = async (slideId: number) => {
  const response = await fetch(`/api/slides/${slideId}`, {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Failed to load reactions for slide ${slideId}`);
  }

  const data = (await response.json()) as { count?: number };
  return typeof data.count === "number" ? data.count : 0;
};

const SlideReactions = ({ slideId }: { slideId: number | null }) => {
  const [activeSlideId, setActiveSlideId] = useState(getActiveSlideId);
  const [count, setCount] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const previousCountRef = useRef(0);
  const skipNextThresholdEffectRef = useRef(true);
  const isActive = slideId !== null && activeSlideId === slideId;

  const celebrate = useEffectEvent(async () => {
    if (typeof window === "undefined") {
      return;
    }

    jsConfetti ??= new JSConfetti();

    try {
      await jsConfetti.addConfetti({
        confettiColors: ["#a855f7", "#d946ef", "#ffffff", "#f4f3ec"],
        confettiNumber: 180,
        emojis: ["👍", "🎉", "✨"],
        emojiSize: 42,
      });
    } catch (error) {
      console.error(error);
    }
  });

  useEffect(() => {
    installHistoryEvents();

    const syncActiveSlideId = () => {
      setActiveSlideId(getActiveSlideId());
    };

    syncActiveSlideId();
    window.addEventListener(LOCATION_CHANGE_EVENT, syncActiveSlideId);

    return () => {
      window.removeEventListener(LOCATION_CHANGE_EVENT, syncActiveSlideId);
    };
  }, []);

  const refreshCount = useEffectEvent(async () => {
    if (!isActive || slideId === null) {
      return;
    }

    try {
      const nextCount = await getSlideCount(slideId);
      if (skipNextThresholdEffectRef.current) {
        previousCountRef.current = nextCount;
        skipNextThresholdEffectRef.current = false;
      }
      startTransition(() => {
        setCount(nextCount);
      });
    } catch (error) {
      console.error(error);
    }
  });

  useEffect(() => {
    if (!isActive) {
      skipNextThresholdEffectRef.current = true;
      return;
    }

    const previousCount = previousCountRef.current;
    previousCountRef.current = count;

    if (
      Math.floor(previousCount / CELEBRATION_THRESHOLD) < Math.floor(count / CELEBRATION_THRESHOLD)
    ) {
      void celebrate();
    }
  }, [celebrate, count, isActive]);

  useEffect(() => {
    if (!isActive) {
      return;
    }

    void refreshCount();
    const pollTimer = window.setInterval(() => {
      void refreshCount();
    }, POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(pollTimer);
    };
  }, [isActive, refreshCount]);

  const handleIncrement = async () => {
    if (slideId === null || isSubmitting) {
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/slides/${slideId}`, {
        method: "POST",
      });
      if (!response.ok) {
        throw new Error(`Failed to add reaction for slide ${slideId}`);
      }

      const data = (await response.json()) as { count?: number };
      setCount(typeof data.count === "number" ? data.count : count);
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="slide-reactions">
      <span className="slide-reaction-count">{count}</span>
      <button
        className="slide-reaction-button"
        disabled={!isActive || isSubmitting}
        onClick={handleIncrement}
        type="button"
      >
        {isSubmitting ? "..." : "👍 +1"}
      </button>
    </div>
  );
};

export const Container = ({ children, style }: { children: ReactNode; style: CSSProperties }) => {
  const slideShellRef = useRef<HTMLDivElement>(null);
  const [slideId, setSlideId] = useState<number | null>(null);

  useLayoutEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const slideShell = slideShellRef.current;
      if (!slideShell) {
        return;
      }

      const slideShells = Array.from(document.querySelectorAll<HTMLDivElement>(".slide-shell"));
      const nextSlideId = slideShells.indexOf(slideShell);
      setSlideId(nextSlideId >= 0 ? nextSlideId : null);
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div className="slide-shell" ref={slideShellRef} style={style}>
      {children}
      <SlideReactions slideId={slideId} />
    </div>
  );
};

export const Components: Record<string, ElementType> = {
  Visible,
  LiquidGlass: ({ style, ...props }) => (
    <LiquidGlass
      displacementScale={64}
      blurAmount={0.1}
      saturation={124}
      aberrationIntensity={2}
      elasticity={0.35}
      borderRadius={64}
      style={{
        ...style,
      }}
      {...props}
    />
  ),
  Center: ({ children, style }) => (
    <div
      style={{
        alignItems: "center",
        display: "flex",
        flex: 1,
        justifyContent: "center",
        ...style,
      }}
    >
      {children}
    </div>
  ),
  Appear: ({ children, delay = 0.3, initialScale = 0 }) => (
    <Visible>
      <motion.div
        animate={{
          opacity: 1,
          transform: `scale(1)`,
        }}
        initial={{
          opacity: 0,
          transform: `scale(${initialScale})`,
        }}
        transition={{
          delay,
          ease: [0.34, 1.26, 0.64, 1],
        }}
        style={{
          alignItems: "center",
          display: "flex",
          flex: 1,
          justifyContent: "center",
        }}
      >
        {children}
      </motion.div>
    </Visible>
  ),
  Code: ({ className, style, ...props }) => (
    <div className={className} style={{ fontSize: "0.5em", ...style }} {...props} />
  ),
  Question: ({ children }) => (
    <span
      style={{
        textTransform: "none",
      }}
    >
      {children}
    </span>
  ),
  Lowercase: ({ children, nowrap }) => (
    <span
      style={{
        textTransform: "lowercase",
        ...(nowrap ? { whiteSpace: "nowrap" } : null),
      }}
    >
      {children}
    </span>
  ),
  Logo,
  Video: ({
    className,
    src,
    ...props
  }: {
    className?: string;
    src: string;
    style?: React.CSSProperties;
  }) => {
    const dotIndex = src.lastIndexOf(".");
    const extension = src.slice(Math.max(0, dotIndex + 1));
    return (
      <video autoPlay className={className} loop muted preload="auto" playsInline {...props}>
        <source src={src} type={`video/${extension}`} />
        <source src={`${src.slice(0, Math.max(0, dotIndex))}.mp4`} type="video/mp4" />
      </video>
    );
  },
  img: ({ className, ...props }) => {
    const [src, search] = props.src.split("?");
    const style: Record<string, string> = {};
    if (search) {
      for (const [key, value] of new URLSearchParams(search).entries()) {
        style[key] = value;
      }
    }
    return <img {...props} loading="eager" className={className} src={src} style={style} />;
  },
  QRCode,
  FunDemoQRCode,
  a: (props) => {
    return <a target="_blank" {...props} />;
  },
};
