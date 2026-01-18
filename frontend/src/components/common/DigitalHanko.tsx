
import React, { useEffect, useRef } from 'react';

interface DigitalHankoProps {
  name: string;
  size?: number;
  variant?: 'approval' | 'rejection' | 'custom';
  customColor?: string;
}

/**
 * DigitalHanko - Sello digital japonés (判子/印鑑)
 * Renderiza un sello circular rojo tradicional con texto vertical
 */
const DigitalHanko: React.FC<DigitalHankoProps> = ({
  name,
  size = 64,
  variant = 'approval',
  customColor
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Colores según variante
  const colors = {
    approval: { fill: '#dc2626', stroke: '#991b1b', text: '#ffffff' },
    rejection: { fill: '#6b7280', stroke: '#4b5563', text: '#ffffff' },
    custom: { fill: customColor || '#dc2626', stroke: customColor || '#991b1b', text: '#ffffff' }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const color = colors[variant];
    const centerX = size / 2;
    const centerY = size / 2;
    const radius = size / 2 - 3;

    // Limpiar canvas
    ctx.clearRect(0, 0, size, size);

    // Círculo exterior (borde)
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.strokeStyle = color.stroke;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Círculo interior (fondo)
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius - 1, 0, 2 * Math.PI);
    ctx.fillStyle = color.fill;
    ctx.fill();

    // Efecto de textura (simular tinta irregular)
    ctx.globalAlpha = 0.1;
    for (let i = 0; i < 20; i++) {
      const x = centerX + (Math.random() - 0.5) * radius * 1.5;
      const y = centerY + (Math.random() - 0.5) * radius * 1.5;
      const r = Math.random() * 3 + 1;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, 2 * Math.PI);
      ctx.fillStyle = '#000000';
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Texto vertical japonés
    const chars = name.split('');
    const maxChars = Math.min(chars.length, 4); // Máximo 4 caracteres
    const fontSize = size / (maxChars + 1.5);

    ctx.fillStyle = color.text;
    ctx.font = `bold ${fontSize}px 'Noto Sans JP', 'Hiragino Kaku Gothic Pro', 'MS Gothic', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Calcular espaciado vertical
    const totalHeight = fontSize * maxChars * 0.9;
    const startY = centerY - totalHeight / 2 + fontSize / 2;

    // Dibujar cada carácter verticalmente
    for (let i = 0; i < maxChars; i++) {
      const y = startY + i * fontSize * 0.9;
      ctx.fillText(chars[i], centerX, y);
    }

    // Efecto de desgaste en los bordes
    ctx.globalCompositeOperation = 'destination-out';
    ctx.globalAlpha = 0.05;
    for (let i = 0; i < 30; i++) {
      const angle = Math.random() * 2 * Math.PI;
      const dist = radius - Math.random() * 5;
      const x = centerX + Math.cos(angle) * dist;
      const y = centerY + Math.sin(angle) * dist;
      ctx.beginPath();
      ctx.arc(x, y, Math.random() * 2, 0, 2 * Math.PI);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;

  }, [name, size, variant, customColor]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      className="inline-block"
      style={{ imageRendering: 'crisp-edges' }}
      aria-label={`${name}の印鑑`}
      role="img"
    />
  );
};

export default DigitalHanko;
