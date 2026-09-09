import BoardTaskTree from './BoardTaskTree';

/**
 * Completed column: Epics (and Mediums) wrap their completed children
 * and start collapsed so the list stays scannable.
 */
const CompletedTaskTree = ({ tasks = [], allTasks, cardProps = {} }) => (
  <BoardTaskTree
    tasks={tasks}
    allTasks={allTasks}
    cardProps={{ ...cardProps, hideStaffTools: true }}
    defaultExpanded={false}
    layout="grid"
    nestedLabel="nested completed"
    emptyMessage="No completed tasks yet. Accepted work appears here."
  />
);

export default CompletedTaskTree;
