/**
 * Safely evaluates arithmetic expressions without eval()
 */
export function evaluateMathExpression(expr: string): number {
  try {
    let clean = expr
      .replace(/×/g, '*')
      .replace(/÷/g, '/')
      .replace(/[^0-9+\-*/.]/g, '');

    // Allow leading negative sign
    if (clean.startsWith('-')) {
      clean = '0' + clean;
    }

    if (!clean || /^[^0-9(]/.test(clean)) return 0;

    const tokens: (number | string)[] = [];
    let curNum = '';
    for (const char of clean) {
      if ('+-*/'.includes(char)) {
        if (curNum !== '') {
          tokens.push(parseFloat(curNum));
          curNum = '';
        }
        tokens.push(char);
      } else {
        curNum += char;
      }
    }
    if (curNum !== '') {
      tokens.push(parseFloat(curNum));
    }

    if (tokens.length === 0) return 0;
    if (tokens.length === 1 && typeof tokens[0] === 'number') return tokens[0];

    const pass1: (number | string)[] = [];
    let i = 0;
    while (i < tokens.length) {
      const token = tokens[i];
      if (token === '*' || token === '/') {
        const prev = pass1.pop() as number;
        const next = (tokens[i + 1] ?? 1) as number;
        if (token === '*') {
          pass1.push(prev * next);
        } else {
          pass1.push(next === 0 ? 0 : prev / next);
        }
        i += 2;
      } else {
        pass1.push(token);
        i++;
      }
    }

    let result = (pass1[0] as number) || 0;
    i = 1;
    while (i < pass1.length) {
      const op = pass1[i];
      const val = (pass1[i + 1] ?? 0) as number;
      if (op === '+') result += val;
      else if (op === '-') result -= val;
      i += 2;
    }

    return isNaN(result) ? 0 : Number(result.toFixed(2));
  } catch {
    return 0;
  }
}
