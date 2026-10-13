import React from 'react';
import { View, StyleSheet } from 'react-native';
import { MarkdownParser, ContentBlock } from './MarkdownParser';
import { CodeBlockView } from './CodeBlockView';
import { MathBlockView } from './MathBlockView';
import { HeadingView } from './HeadingView';
import { ListContainerView } from './ListContainerView';
import { ParagraphView } from './ParagraphView';

interface RichMessageContentProps {
  content: string;
}

export const RichMessageContent: React.FC<RichMessageContentProps> = ({ content }) => {
  if (!content) return null;

  const blocks: ContentBlock[] = MarkdownParser.parse(content);

  return (
    <View style={styles.container}>
      {blocks.map((block, index) => {
        switch (block.type) {
          case 'code':
            return (
              <CodeBlockView
                key={index}
                language={block.language}
                code={block.code}
              />
            );
          case 'math_block':
            return (
              <MathBlockView
                key={index}
                raw={block.raw}
                formatted={block.formatted}
              />
            );
          case 'heading':
            return (
              <HeadingView
                key={index}
                level={block.level}
                text={block.text}
              />
            );
          case 'list':
            return (
              <ListContainerView
                key={index}
                listType={block.listType}
                items={block.items}
              />
            );
          case 'paragraph':
          default:
            return (
              <ParagraphView
                key={index}
                text={block.text}
              />
            );
        }
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
});
