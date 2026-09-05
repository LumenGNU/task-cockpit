// color.mjs — semantic terminal styling with nestable attributes
// Поддержка NO_COLOR / FORCE_COLOR / TTY

const hasColor = true;
// !process.env.NO_COLOR && // @fixme
// (!!process.env.FORCE_COLOR ||
//     process.stdout.isTTY ||
//     process.stderr.isTTY);

// Фабрика стиля с отдельным сбросом
const style = (open, close) => (text) =>
    hasColor ? `\x1b[${open}m${text}\x1b[${close}m` : text;

// --- Semantic styles (можно вкладывать) ---
export const fail = style(31, 39); // красный
export const warn = style(33, 39); // жёлтый
export const info = style(36, 39); // голубой
export const success = style(32, 39); // зелёный
export const subtle = style(2, 22);  // тусклый (dim)

// --- Низкоуровневые атрибуты для вложения ---
export const bold = style(1, 22);  // жирный
export const underline = style(4, 24); // подчёркивание

// --- Полный сброс (на всякий случай) ---
export const reset = (text) => hasColor ? `\x1b[0m${text}` : text;