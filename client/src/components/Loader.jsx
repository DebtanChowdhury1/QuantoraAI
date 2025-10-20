import { motion } from 'framer-motion';

const Loader = ({ label = 'Fetching data' }) => (
  <div className="flex min-h-[200px] flex-col items-center justify-center gap-4 text-neutral-300">
    <motion.div
      className="h-12 w-12 rounded-full border-2 border-accent/30 border-t-accent"
      animate={{ rotate: 360 }}
      transition={{ repeat: Infinity, duration: 1.2, ease: 'linear' }}
    />
    <p className="text-sm">{label}…</p>
  </div>
);

export default Loader;
