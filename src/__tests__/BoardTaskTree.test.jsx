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
});
