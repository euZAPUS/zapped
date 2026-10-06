// Short, realistic snippets for the code mode. Indentation is part of the source
// but is skipped automatically while typing (see parseCustomText).

export type CodeLang = 'c' | 'python' | 'javascript' | 'bash' | 'sql';

export interface CodeLangInfo {
  id: CodeLang;
  label: string;
  snippets: string[];
}

const c: string[] = [
  `size_t\tft_strlen(const char *s)
{
\tsize_t\ti;

\ti = 0;
\twhile (s[i])
\t\ti++;
\treturn (i);
}`,
  `void\t*ft_memcpy(void *dst, const void *src, size_t n)
{
\tunsigned char\t*d;
\tconst unsigned char\t*s;

\tif (!dst && !src)
\t\treturn (NULL);
\td = (unsigned char *)dst;
\ts = (const unsigned char *)src;
\twhile (n--)
\t\t*d++ = *s++;
\treturn (dst);
}`,
  `int\tmain(int argc, char **argv)
{
\tint\ti;

\tif (argc < 2)
\t\treturn (write(2, "usage: ./a.out file\\n", 20), 1);
\ti = 1;
\twhile (i < argc)
\t{
\t\tprintf("%s\\n", argv[i]);
\t\ti++;
\t}
\treturn (0);
}`,
  `t_list\t*ft_lstnew(void *content)
{
\tt_list\t*node;

\tnode = malloc(sizeof(t_list));
\tif (!node)
\t\treturn (NULL);
\tnode->content = content;
\tnode->next = NULL;
\treturn (node);
}`,
];

const python: string[] = [
  `def fibonacci(n: int) -> list[int]:
    seq = [0, 1]
    while len(seq) < n:
        seq.append(seq[-1] + seq[-2])
    return seq[:n]

print(fibonacci(10))`,
  `class Stack:
    def __init__(self):
        self._items = []

    def push(self, item):
        self._items.append(item)

    def pop(self):
        if not self._items:
            raise IndexError("stack is empty")
        return self._items.pop()`,
  `import json
from pathlib import Path

def load_config(path: str) -> dict:
    file = Path(path)
    if not file.exists():
        return {}
    with file.open(encoding="utf-8") as fh:
        return json.load(fh)`,
];

const javascript: string[] = [
  `const debounce = (fn, delay = 300) => {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
};`,
  `async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(\`HTTP \${res.status}\`);
  }
  return res.json();
}`,
  `const groupBy = (items, key) =>
  items.reduce((acc, item) => {
    (acc[item[key]] ||= []).push(item);
    return acc;
  }, {});`,
];

const bash: string[] = [
  `#!/usr/bin/env bash
set -euo pipefail

for file in *.log; do
  if [ -s "$file" ]; then
    gzip -9 "$file"
  fi
done`,
  `nmap -sV -sC -p- -T4 -oN scan.txt 10.10.10.5
grep -E "open|filtered" scan.txt | sort -u
sudo iptables -A INPUT -p tcp --dport 22 -j DROP`,
  `find . -type f -name "*.c" -print0 |
  xargs -0 grep -n "malloc" |
  cut -d: -f1 |
  sort | uniq -c | sort -rn | head`,
];

const sql: string[] = [
  `SELECT u.name, COUNT(o.id) AS orders
FROM users u
LEFT JOIN orders o ON o.user_id = u.id
WHERE u.created_at > '2024-01-01'
GROUP BY u.name
HAVING COUNT(o.id) > 3
ORDER BY orders DESC;`,
  `CREATE TABLE sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL
);`,
];

export const CODE_LANGS: Record<CodeLang, CodeLangInfo> = {
  c: { id: 'c', label: 'C', snippets: c },
  python: { id: 'python', label: 'Python', snippets: python },
  javascript: { id: 'javascript', label: 'JavaScript', snippets: javascript },
  bash: { id: 'bash', label: 'Bash', snippets: bash },
  sql: { id: 'sql', label: 'SQL', snippets: sql },
};

export const CODE_LANG_IDS = Object.keys(CODE_LANGS) as CodeLang[];

/** Picks a snippet, avoiding the one used last time when there is a choice. */
export function pickSnippet(lang: CodeLang, avoid?: string, rng: () => number = Math.random): string {
  const list = CODE_LANGS[lang].snippets;
  const options = list.length > 1 ? list.filter((s) => s !== avoid) : list;
  return options[Math.floor(rng() * options.length)] as string;
}
