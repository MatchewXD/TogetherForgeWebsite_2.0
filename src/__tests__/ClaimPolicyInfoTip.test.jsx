import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ClaimPolicyInfoTip from '../components/tasks/ClaimPolicyInfoTip';
import TaskCard from '../components/ui/TaskCard';
import {
  CLAIM_AUTO_RELEASE_POLICY_COPY,
  HOLD_CLAIM_DETAIL_COPY,
} from '../services/tasksService';

function renderClaimableCard() {
  return render(
    <MemoryRouter>
      <TaskCard
        task={{
          id: 's1',
          title: 'Tether-4.1 ResourceNode and carry limit',
          depth: 2,
          status: 'todo',
          dbStatus: 'ToDo',
          category: 'Code',
        }}
        onClaim={() => {}}
        onView={() => {}}
      />
    </MemoryRouter>
  );
}

describe('ClaimPolicyInfoTip', () => {
  it('keeps claim rules in a hover info control, not as always-visible copy', () => {
    render(<ClaimPolicyInfoTip category="Code" />);
    expect(
      screen.getByRole('button', { name: /how claiming works/i })
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/claiming reserves this task/i)
    ).not.toBeInTheDocument();

    fireEvent.mouseEnter(
      screen.getByRole('button', { name: /how claiming works/i })
    );
    const tip = screen.getByRole('tooltip');
    expect(tip).toHaveTextContent(/claiming reserves this task/i);
    expect(tip).toHaveTextContent(
      /do the technical work on github, then submit for review with a pr or branch link/i
    );
    expect(tip).toHaveTextContent(CLAIM_AUTO_RELEASE_POLICY_COPY);
  });

  it('explains a held card instead of the 14/30-day rules', () => {
    render(<ClaimPolicyInfoTip category="Code" holdClaim />);
    fireEvent.mouseEnter(
      screen.getByRole('button', { name: /how claiming works/i })
    );
    expect(screen.getByRole('tooltip')).toHaveTextContent(HOLD_CLAIM_DETAIL_COPY);
    expect(
      screen.queryByText(/claims auto-release after/i)
    ).not.toBeInTheDocument();
  });

  it('uses a proof-link sentence for non-code tasks', () => {
    render(<ClaimPolicyInfoTip category="Art" />);
    fireEvent.mouseEnter(
      screen.getByRole('button', { name: /how claiming works/i })
    );
    expect(screen.getByRole('tooltip')).toHaveTextContent(
      /do the work, then submit for review with a clear proof link/i
    );
  });
});

describe('TaskCard claim policy', () => {
  it('puts claim rules on an info icon next to Claim Task', () => {
    renderClaimableCard();
    expect(screen.getByRole('button', { name: /claim task/i })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /how claiming works/i })
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/claiming reserves this task/i)
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/claims auto-release after/i)
    ).not.toBeInTheDocument();
  });

  it('shows a Held badge when staff disabled auto-release', () => {
    render(
      <MemoryRouter>
        <TaskCard
          task={{
            id: 's1',
            title: 'Tether-CD.1 Suit and world palette',
            depth: 2,
            status: 'in_progress',
            dbStatus: 'InProgress',
            category: 'Art',
            holdClaim: true,
            claimedBy: 'staff',
            claim: {
              status: 'Active',
              claimedAt: new Date().toISOString(),
              lastActivityAt: new Date().toISOString(),
              username: 'staff',
            },
          }}
          onView={() => {}}
        />
      </MemoryRouter>
    );
    expect(screen.getByText('Held')).toBeInTheDocument();
    expect(screen.queryByText(/release soon/i)).not.toBeInTheDocument();
  });
});
