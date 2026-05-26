import { useEffect, useState } from 'react';
import { Checkbox, Typography } from 'antd';
import { getTools } from '../api/client';

const { Text } = Typography;

interface Props {
  selected: string[];
  onChange: (selected: string[]) => void;
}

export default function ToolSelector({ selected, onChange }: Props) {
  const [tools, setTools] = useState<any[]>([]);

  useEffect(() => {
    getTools().then(setTools).catch(console.error);
  }, []);

  return (
    <div>
      <Text strong style={{ display: 'block', marginBottom: 8 }}>Tools</Text>
      {tools.map(t => (
        <div key={t.id} style={{ marginBottom: 4 }}>
          <Checkbox
            checked={selected.includes(t.name)}
            disabled={!t.enabled}
            onChange={e => {
              if (e.target.checked) {
                onChange([...selected, t.name]);
              } else {
                onChange(selected.filter(n => n !== t.name));
              }
            }}
          >
            {t.display_name || t.name}
          </Checkbox>
        </div>
      ))}
    </div>
  );
}
