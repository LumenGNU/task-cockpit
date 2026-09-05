# Спецсимволы в строках конфигурации VS Code

## Что проверялось

`vscode.WorkspaceConfiguration.get()` возвращает JS-строку как есть.
Паттерн `/^.$/` — ровно один символ (не LineTerminator).

## Поведение символов

| значение         | description                   | `/^.$/`  | `/^.$/u` |
|------------------|-------------------------------|----------|----------|
| `\u0000`         | null byte                     | ✔ матчит | —        |
| `\n`             | newline                       | ✗        | —        |
| `\r`             | carriage return               | ✗        | —        |
| `\t`             | tab                           | ✔        | —        |
| `\u000B`         | vertical tab                  | ✔        | —        |
| `\u000C`         | form feed                     | ✔        | —        |
| `\u200B`         | zero-width space              | ✔        | —        |
| `\u2028`         | Line Separator                | ✗        | —        |
| `\u2029`         | Paragraph Separator           | ✗        | —        |
| `😀`             | emoji (surrogate pair)        | ✗        | ✔        |
| `e\u0301`        | e + combining accent          | ✗        | ✗        |
| `\`              | одинокий backslash            | ✔        | —        |
| `\x00` (literal) | 4 символа: `\`, `x`, `0`, `0` | ✗        | —        |
