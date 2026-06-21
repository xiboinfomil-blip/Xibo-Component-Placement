import './LoadingSpinner.css';

export default function LoadingSpinner() {
  return (
    <div className="loading-spinner-container">
      {/* Ambient Background Glow */}
      <div className="ambient-glow" />

      <div className="spinner-wrapper">
        {/* The Premium Spinner */}
        <div className="spinner-container">
          {/* Soft pulsing glow behind the spinner */}
          <div className="spinner-glow" />

          {/* Outer Ring */}
          <div className="outer-ring" />

          {/* Inner Ring */}
          <div className="inner-ring" />

          {/* Center Anchor Dot */}
          <div className="center-dot" />
        </div>

        {/* Cinematic Typography */}
        <div className="loading-text">
          <p>Chargement en cours...</p>
        </div>
      </div>
    </div>
  );
}