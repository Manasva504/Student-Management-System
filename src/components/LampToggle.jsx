import { motion } from "framer-motion";

function LampToggle({ isOn, onToggle, swingKey }) {
  return (
    <div className="lamp-rig">
      <div className="lamp-cord-top" />

      <motion.div
        key={swingKey}
        className="lamp-shade-group"
        initial={{ rotate: isOn ? -14 : 14 }}
        animate={{ rotate: 0 }}
        transition={{ type: "spring", stiffness: 170, damping: 7 }}
      >
        <div className={`lamp-shade ${isOn ? "is-on" : ""}`} />
        <div className={`lamp-bulb-glow ${isOn ? "is-on" : ""}`} />
      </motion.div>

      <motion.button
        type="button"
        className="lamp-pull-hit"
        onClick={onToggle}
        whileTap={{ y: 8 }}
        aria-pressed={isOn}
        aria-label={isOn ? "Turn off lamp and hide login form" : "Pull to turn on lamp and reveal login form"}
      >
        <span className="lamp-pull-string" />
        <span className="lamp-pull-knob" />
      </motion.button>
    </div>
  );
}

export default LampToggle;
