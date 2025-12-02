import React from 'react';
import { PluginDefinition } from '../api/types';
import { Stamp } from 'lucide-react';

export const StampPlugin: PluginDefinition = {
  id: 'core-stamp-tool',
  name: 'Stamp Tool',
  version: '0.5.0',
  description: 'A demo global tool that adds a Stamp to the creative toolbar.',
  globalTools: [
      {
          id: 'stamp',
          label: 'Stamp',
          icon: <Stamp className="w-5 h-5" />,
          appearance: {
              type: 'brush',
              color: '#10b981', // Emerald
              widthClass: 'w-12',
              heightClass: 'h-16',
              tipColor: '#047857',
              labelColor: '#fff'
          },
          onClick: (setMode) => {
              alert("Stamp Tool Selected! (Plugin Active)");
          }
      }
  ]
};