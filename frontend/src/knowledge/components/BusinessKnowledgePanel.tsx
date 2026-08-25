import type { components } from '../../api/generated/schema';
import { AnnotationForm } from './AnnotationForm';
import { AnnotationRow } from './AnnotationRow';
import type { AnnotationValues } from '../schemas/annotation-schema';

type Annotation = components['schemas']['KnowledgeAnnotationResponse'];

type Props = {
  annotations: Annotation[];
  canManage: boolean;
  onCreate(values: AnnotationValues): Promise<void>;
  onUpdate(annotationId: string, content: string): Promise<void>;
  onDelete(annotationId: string): Promise<void>;
};

export function BusinessKnowledgePanel({ annotations, canManage, onCreate, onUpdate, onDelete }: Props) {
  return (
    <div className="detail-panel section-space">
      <div className="split-heading"><h2>Business knowledge</h2><span>{annotations.length} annotations</span></div>
      {canManage ? <AnnotationForm onSubmit={onCreate} /> : null}
      <div className="annotation-list">
        {annotations.map((annotation) => (
          <AnnotationRow
            key={annotation.id}
            annotation={annotation}
            canManage={canManage}
            onUpdate={(content) => onUpdate(annotation.id, content)}
            onDelete={() => onDelete(annotation.id)}
          />
        ))}
        {annotations.length === 0 ? <p className="muted-copy">No business annotations yet.</p> : null}
      </div>
    </div>
  );
}
