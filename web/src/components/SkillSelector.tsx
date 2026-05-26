import { useEffect, useState } from 'react';
import { Checkbox, Typography } from 'antd';
import { getSkills } from '../api/client';

const { Text } = Typography;

interface Props {
  selected: string[];
  onChange: (selected: string[]) => void;
}

export default function SkillSelector({ selected, onChange }: Props) {
  const [skills, setSkills] = useState<any[]>([]);

  useEffect(() => {
    getSkills().then(setSkills).catch(console.error);
  }, []);

  return (
    <div>
      <Text strong style={{ display: 'block', marginBottom: 8 }}>Skills</Text>
      {skills.map(s => (
        <div key={s.id} style={{ marginBottom: 4 }}>
          <Checkbox
            checked={selected.includes(s.name)}
            disabled={!s.enabled}
            onChange={e => {
              if (e.target.checked) {
                onChange([...selected, s.name]);
              } else {
                onChange(selected.filter(n => n !== s.name));
              }
            }}
          >
            {s.display_name || s.name}
          </Checkbox>
        </div>
      ))}
    </div>
  );
}
