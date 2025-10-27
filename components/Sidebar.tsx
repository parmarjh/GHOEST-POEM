import React from 'react';

interface SidebarProps {
  inventory: string[];
  quest: string;
}

const Sidebar: React.FC<SidebarProps> = ({ inventory, quest }) => {
  return (
    <aside className="md:w-1/3 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-lg shadow-xl dark:shadow-lg p-6 self-start">
      <div className="mb-8">
        <h2 className="text-xl font-bold text-cyan-600 dark:text-cyan-300 border-b-2 border-cyan-500/50 dark:border-cyan-700/50 pb-2 mb-3">
          Current Quest
        </h2>
        <p className="text-gray-700 dark:text-gray-300">{quest}</p>
      </div>
      <div>
        <h2 className="text-xl font-bold text-cyan-600 dark:text-cyan-300 border-b-2 border-cyan-500/50 dark:border-cyan-700/50 pb-2 mb-3">
          Inventory
        </h2>
        {inventory.length > 0 ? (
          <ul className="space-y-2">
            {inventory.map((item, index) => (
              <li key={index} className="bg-gray-100 dark:bg-gray-700/50 p-2 rounded-md text-gray-800 dark:text-gray-200">
                - {item}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-500 dark:text-gray-400 italic">Your pockets are empty.</p>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;