/**
 * Lexical serialized state types
 * Using custom types to avoid strict type checking issues with @payloadcms/richtext-lexical
 */
interface LexicalTextNode {
  type: "text";
  text: string;
  format?: number;
}

interface LexicalElementNode {
  type: string;
  children?: LexicalNode[];
  tag?: string;
}

type LexicalNode = LexicalTextNode | LexicalElementNode;

interface LexicalRootNode {
  children: LexicalNode[];
}

export interface LexicalEditorState {
  root: LexicalRootNode;
}

interface RichTextProps {
  content: LexicalEditorState;
}

/**
 * Renders Lexical rich text content from Payload CMS
 * Supports paragraphs and headings (h1-h6)
 */
export function RichText({ content }: RichTextProps) {
  if (!content?.root?.children) return null;

  return (
    <div className="prose prose-lg dark:prose-invert max-w-none">
      {content.root.children.map((node, index) => (
        <RenderNode key={index} node={node} />
      ))}
    </div>
  );
}

function RenderNode({ node }: { node: LexicalNode }) {
  if (node.type === "paragraph") {
    const elementNode = node as LexicalElementNode;
    return (
      <p>
        {elementNode.children?.map((child, i) => (
          <RenderTextNode key={i} node={child} />
        ))}
      </p>
    );
  }

  if (node.type === "heading") {
    const elementNode = node as LexicalElementNode;
    const tag = elementNode.tag || "h2";
    const HeadingTag = tag as "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
    return (
      <HeadingTag>
        {elementNode.children?.map((child, i) => (
          <RenderTextNode key={i} node={child} />
        ))}
      </HeadingTag>
    );
  }

  return null;
}

function RenderTextNode({ node }: { node: LexicalNode }) {
  if (node.type === "text") {
    const textNode = node as LexicalTextNode;
    return <>{textNode.text}</>;
  }

  // Handle linebreak nodes
  if (node.type === "linebreak") {
    return <br />;
  }

  return null;
}
