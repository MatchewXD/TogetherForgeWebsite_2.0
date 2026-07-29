import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ProjectsEarly from '../pages/ProjectsEarly';

// Basic smoke test – ensures the page renders without crashing
describe('ProjectsEarly page', () => {
  it('renders the Early Game Project Hub header and Tether as active project', () => {
    render(
      <MemoryRouter>
        <ProjectsEarly />
      </MemoryRouter>
    );
    expect(screen.getByText(/Early Game Project Hub/i)).toBeInTheDocument();
    expect(screen.getAllByText(/^Tether$/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole('heading', { name: /Active Project/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Early Game Ideas/i })).toBeInTheDocument();
    expect(
      screen.queryByText(/We did it/i)
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Early Game Project 2/i)
    ).not.toBeInTheDocument();
  });
});
