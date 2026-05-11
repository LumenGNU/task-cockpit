const spaces = [
    { name: "Обычный (Space)       ", char: "\u0020" },
    { name: "Неразрывный (NBSP)    ", char: "\u00A0" },
    { name: "En Space (1/2 Em)     ", char: "\u2002" },
    { name: "Thin Space (1/5-1/6)  ", char: "\u2009" },
    { name: "Narrow NBSP           ", char: "\u202F" },
    { name: "Six-Per-Em (1/6)      ", char: "\u2006" },
    { name: "Hair Space (Волосной) ", char: "\u200A" },
    { name: "Zero Width (Нулевой)  ", char: "\u200B" }
];

console.log("Сравнение ширины пробелов:");
console.log("---------------------------");

spaces.forEach(s => {
    // Выводим: Название | Hex | Визуальный замер между X и X
    const hex = s.char.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0');
    console.log(`${s.name} | U+${hex} | >X${s.char}X<`);
});