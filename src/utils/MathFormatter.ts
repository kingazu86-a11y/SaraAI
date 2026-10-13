/**
 * Converts LaTeX math expressions into readable, clean Unicode mathematics.
 */
export class MathFormatter {
  private static readonly SUPERSCRIPTS: Record<string, string> = {
    '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
    '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
    '+': '⁺', '-': '⁻', '=': '⁼', '(': '⁽', ')': '⁾',
    'n': 'ⁿ', 'i': 'ⁱ', 'x': 'ˣ', 'y': 'ʸ', 'a': 'ᵃ', 'b': 'ᵇ',
  };

  private static readonly SUBSCRIPTS: Record<string, string> = {
    '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
    '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
    '+': '₊', '-': '₋', '=': '₌', '(': '₍', ')': '₎',
    'a': 'ₐ', 'e': 'ₑ', 'h': 'ₕ', 'i': 'ᵢ', 'j': 'ⱼ',
    'k': 'ₖ', 'l': 'ₗ', 'm': 'ₘ', 'n': 'ₙ', 'o': 'ₒ',
    'p': 'ₚ', 'r': 'ᵣ', 's': 'ₛ', 't': 'ₜ', 'u': 'ᵤ', 'v': 'ᵥ', 'x': 'ₓ',
  };

  private static toSuperscript(str: string): string {
    return str
      .split('')
      .map(char => this.SUPERSCRIPTS[char] || char)
      .join('');
  }

  private static toSubscript(str: string): string {
    return str
      .split('')
      .map(char => this.SUBSCRIPTS[char] || char)
      .join('');
  }

  public static format(latex: string): string {
    if (!latex) return '';

    let res = latex.trim();

    // 1. Remove wrapping delimiters like $$...$$, $...$, \[...\], \(...\)
    res = res.replace(/^\$\$([\s\S]*?)\$\$$/, '$1');
    res = res.replace(/^\$([\s\S]*?)\$$/, '$1');
    res = res.replace(/^\\\[([\s\S]*?)\\\]$/, '$1');
    res = res.replace(/^\\\(([\s\S]*?)\\\)$/, '$1');

    // 2. Fractions: \frac{a}{b} -> (a / b)
    while (/\\frac\s*\{([^{}]+)\}\s*\{([^{}]+)\}/.test(res)) {
      res = res.replace(/\\frac\s*\{([^{}]+)\}\s*\{([^{}]+)\}/g, '($1 / $2)');
    }

    // 3. Square Roots: \sqrt{x} -> √(x), \sqrt[n]{x} -> ⁿ√(x)
    res = res.replace(/\\sqrt\[([^{}]+)\]\{([^{}]+)\}/g, (_m, n, x) => `${this.toSuperscript(n)}√(${x})`);
    res = res.replace(/\\sqrt\{([^{}]+)\}/g, '√($1)');

    // 4. Superscripts: ^{abc} or ^2 -> Unicode superscripts
    res = res.replace(/\^\{([^{}]+)\}/g, (_m, p1) => this.toSuperscript(p1));
    res = res.replace(/\^([0-9nixyab])/g, (_m, p1) => this.toSuperscript(p1));

    // 5. Subscripts: _{abc} or _1 -> Unicode subscripts
    res = res.replace(/_\{([^{}]+)\}/g, (_m, p1) => this.toSubscript(p1));
    res = res.replace(/_([0-9aehijklmnoprstuvx])/g, (_m, p1) => this.toSubscript(p1));

    // 6. Greek Letters
    const greekMap: Record<string, string> = {
      '\\alpha': 'α', '\\beta': 'β', '\\gamma': 'γ', '\\delta': 'δ',
      '\\epsilon': 'ε', '\\varepsilon': 'ε', '\\zeta': 'ζ', '\\eta': 'η',
      '\\theta': 'θ', '\\iota': 'ι', '\\kappa': 'κ', '\\lambda': 'λ',
      '\\mu': 'μ', '\\nu': 'ν', '\\xi': 'ξ', '\\pi': 'π', '\\varpi': 'ϖ',
      '\\rho': 'ρ', '\\sigma': 'σ', '\\tau': 'τ', '\\upsilon': 'υ',
      '\\phi': 'φ', '\\varphi': 'ϕ', '\\chi': 'χ', '\\psi': 'ψ',
      '\\omega': 'ω', '\\Gamma': 'Γ', '\\Delta': 'Δ', '\\Theta': 'Θ',
      '\\Lambda': 'Λ', '\\Xi': 'Ξ', '\\Pi': 'Π', '\\Sigma': 'Σ',
      '\\Upsilon': 'Υ', '\\Phi': 'Φ', '\\Psi': 'Ψ', '\\Omega': 'Ω',
    };
    for (const [tex, uni] of Object.entries(greekMap)) {
      res = res.split(tex).join(uni);
    }

    // 7. Common Math Symbols & Operators
    const symbolMap: Record<string, string> = {
      '\\times': '×',
      '\\cdot': '·',
      '\\div': '÷',
      '\\pm': '±',
      '\\mp': '∓',
      '\\leq': '≤',
      '\\le': '≤',
      '\\geq': '≥',
      '\\ge': '≥',
      '\\neq': '≠',
      '\\ne': '≠',
      '\\approx': '≈',
      '\\sim': '~',
      '\\equiv': '≡',
      '\\infty': '∞',
      '\\sum': '∑',
      '\\prod': '∏',
      '\\int': '∫',
      '\\iint': '∬',
      '\\iiint': '∭',
      '\\oint': '∮',
      '\\partial': '∂',
      '\\nabla': '∇',
      '\\in': '∈',
      '\\notin': '∉',
      '\\subset': '⊂',
      '\\subseteq': '⊆',
      '\\cup': '∪',
      '\\cap': '∩',
      '\\forall': '∀',
      '\\exists': '∃',
      '\\nexists': '∄',
      '\\to': '→',
      '\\rightarrow': '→',
      '\\leftarrow': '←',
      '\\Rightarrow': '⇒',
      '\\Leftarrow': '⇐',
      '\\Leftrightarrow': '⇔',
      '\\ldots': '...',
      '\\cdots': '···',
      '\\circ': '°',
      '\\angle': '∠',
    };
    for (const [tex, uni] of Object.entries(symbolMap)) {
      res = res.split(tex).join(uni);
    }

    // 8. Clean Formatting Artifacts
    res = res.replace(/\\text\s*\{([^{}]+)\}/g, '$1');
    res = res.replace(/\\mathrm\s*\{([^{}]+)\}/g, '$1');
    res = res.replace(/\\mathbf\s*\{([^{}]+)\}/g, '$1');
    res = res.replace(/\\mathit\s*\{([^{}]+)\}/g, '$1');
    res = res.replace(/\\left\s*([(\[{|])/g, '$1');
    res = res.replace(/\\right\s*([)\]}|])/g, '$1');
    res = res.replace(/\\[,;:!]/g, ' ');
    res = res.replace(/\\quad/g, '   ');
    res = res.replace(/\\qquad/g, '      ');
    res = res.replace(/[{}]/g, '');

    return res.trim();
  }
}
