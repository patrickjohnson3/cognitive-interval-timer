function scalarValue(rawValue) {
  const value = rawValue.trim();
  if (value === "") return {};
  if (value === "|") return "";
  if (value === ">") return "";
  if (value === "true") return true;
  if (value === "false") return false;
  return value.replace(/^['"]|['"]$/g, "");
}

function nextContentLine(lines, index) {
  for (let i = index + 1; i < lines.length; i += 1) {
    const trimmed = lines[i].trim();
    if (trimmed && !trimmed.startsWith("#")) return trimmed;
  }
  return "";
}

function parseWorkflowYaml(source) {
  const root = {};
  const stack = [{ indent: -1, value: root }];
  const lines = source.split(/\r?\n/);

  lines.forEach(function parseLine(line, index) {
    if (!line.trim() || line.trim().startsWith("#")) return;

    const indent = line.match(/^ */)[0].length;
    const trimmed = line.trim();
    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) stack.pop();

    const parent = stack[stack.length - 1].value;

    if (trimmed.startsWith("- ")) {
      const entry = trimmed.slice(2);
      const keyValue = entry.match(/^([^:]+):(.*)$/);
      const item = keyValue ? {} : scalarValue(entry);
      if (!Array.isArray(parent)) return;
      parent.push(item);

      if (keyValue) {
        item[keyValue[1].trim()] = scalarValue(keyValue[2]);
        stack.push({ indent, value: item });
      }
      return;
    }

    const match = trimmed.match(/^([^:]+):(.*)$/);
    if (!match) return;

    const key = match[1].trim();
    const rawValue = match[2];
    if (rawValue.trim() === ">" || rawValue.trim() === "|") {
      const folded = [];
      for (let i = index + 1; i < lines.length; i += 1) {
        const nextIndent = lines[i].match(/^ */)[0].length;
        if (lines[i].trim() && nextIndent <= indent) break;
        if (lines[i].trim()) folded.push(lines[i].trim());
      }
      parent[key] = folded.join(" ");
      return;
    }

    const value = scalarValue(rawValue);
    parent[key] = value;

    if (rawValue.trim() === "") {
      const nextValue = nextContentLine(lines, index).startsWith("- ") ? [] : {};
      parent[key] = nextValue;
      stack.push({ indent, value: nextValue });
      return;
    }

    if (typeof value === "object" && value !== null) {
      stack.push({ indent, value });
    }
  });

  return root;
}

module.exports = {
  parseWorkflowYaml,
};
