import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import BoardTaskTree from '../components/ui/BoardTaskTree';

function task(partial) {
  return {
    id: partial.id,
    title: partial.title,
    parentTaskId: partial.parentTaskId ?? null,
    depth: partial.depth ?? 0,
    status: 'todo',
    dbStatus: 'ToDo',
    sortOrder: partial.sortOrder ?? 0,
    category: 'Code',
    ...partial,
  };
}

describe('BoardTaskTree', () => {
  it('nests smalls under their medium and epic', () => {
    const epic = task({
      id: 'e',
      title: 'Tether-4 Resources and warp',
      depth: 0,
      sortOrder: 40,
    });
    const med = task({
      id: 'm',
      title: 'Tether-4.1 Resource nodes',
      parentTaskId: 'e',
      depth: 1,
      sortOrder: 10,
    });
    const small = task({
      id: 's',
      title: 'Tether-4.1.1 ResourceNode prefab and interact',
      parentTaskId: 'm',
      depth: 2,
      sortOrder: 10,
    });

    render(
      <MemoryRouter>
        <BoardTaskTree
          tasks={[small, epic, med]}
          defaultExpanded
          layout="stack"
        />
      </MemoryRouter>
    );

    const titles = screen.getAllByRole('heading').map((el) => el.textContent);
    expect(titles[0]).toMatch(/Tether-4 Resources and warp/);
    expect(titles[1]).toMatch(/Tether-4\.1 Resource nodes/);
    expect(titles[2]).toMatch(/Tether-4\.1\.1 ResourceNode prefab/);
  });

  it('nests blocked mediums under the epic in a top-level slice', () => {
    const epic = task({
      id: 'e',
      title: 'Tether-6 First playable surface level',
      sortOrder: 60,
    });
    const kit = task({
      id: 'kit',
      title: 'Tether-6.1 Modular kit',
      parentTaskId: 'e',
      depth: 1,
      sortOrder: 10,
    });
    const ground = task({
      id: 'g',
      title: 'Tether-6.1.2 Block out Level_01_Surface',
      parentTaskId: 'kit',
      depth: 2,
      sortOrder: 20,
      isLocked: true,
    });
    const section2 = task({
      id: 's2',
      title: 'Tether-6.3 Section 2 floating rocks and islands',
      parentTaskId: 'e',
      depth: 1,
      sortOrder: 30,
      isLocked: true,
    });
    const section3 = task({
      id: 's3',
      title: 'Tether-6.4 Section 3 space',
      parentTaskId: 'e',
      depth: 1,
      sortOrder: 40,
      isLocked: true,
    });
    const arena = task({
      id: 's5',
      title: 'Tether-6.5 Finale arena',
      parentTaskId: 'e',
      depth: 1,
      sortOrder: 50,
      isLocked: true,
    });
    const loop = task({
      id: 's2old',
      title: 'Tether-6.2 End-to-end 1-4 player loop',
      parentTaskId: 'e',
      depth: 1,
      sortOrder: 20,
      isLocked: true,
    });

    render(
      <MemoryRouter>
        <BoardTaskTree
          tasks={[epic, ground, section2, section3, arena, loop]}
          allTasks={[epic, kit, ground, section2, section3, arena, loop]}
          defaultExpanded
          layout="stack"
        />
      </MemoryRouter>
    );

    const titles = screen.getAllByRole('heading').map((el) => el.textContent);
    expect(titles[0]).toMatch(/Tether-6 First playable surface level/);
    expect(titles.slice(1).join('\n')).toMatch(/Tether-6\.2 End-to-end/);
    expect(titles.slice(1).join('\n')).toMatch(/Tether-6\.3 Section 2/);
    expect(titles.slice(1).join('\n')).toMatch(/Tether-6\.4 Section 3/);
    expect(titles.slice(1).join('\n')).toMatch(/Tether-6\.5 Finale arena/);
    expect(titles.slice(1).join('\n')).toMatch(
      /Tether-6\.1\.2 Block out Level_01_Surface/
    );
    expect(titles.filter((t) => t.startsWith('Tether-6 ')).length).toBe(1);
  });
});
