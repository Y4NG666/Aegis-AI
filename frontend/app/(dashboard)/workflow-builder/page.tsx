import { WorkflowEditorHeader } from "@/components/workflow/workflow-editor-header";
import { WorkflowNodeCanvas } from "@/components/workflow/workflow-node-canvas";
import { WorkflowPalette } from "@/components/workflow/workflow-palette";

export default function WorkflowBuilderPage() {
  return (
    <div className="pb-24">
      <WorkflowEditorHeader />

      <section className="flex flex-col overflow-hidden md:min-h-[calc(100vh-8.5rem)] md:flex-row">
        <WorkflowNodeCanvas />
        <WorkflowPalette />
      </section>
    </div>
  );
}
