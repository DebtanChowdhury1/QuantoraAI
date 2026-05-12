const Loader = ({ label = 'Fetching data' }) => (
  <div className="flex min-h-[200px] flex-col items-center justify-center gap-4 text-neutral-300">
    <div className="h-12 w-12 animate-spin rounded-full border-2 border-accent/30 border-t-accent" />
    <p className="text-sm">{label}...</p>
  </div>
);

export default Loader;
