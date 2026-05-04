/**
 * ForgeInputNode — Custom node para categoría INPUT.
 * Delega rendering a ForgeNodeBase.
 * @version WAVE 4548.8c
 */
import React, { memo } from 'react'
import type { NodeProps } from '@xyflow/react'
import { ForgeNodeBase, type ForgeNode } from './ForgeNodeBase'

export const ForgeInputNode: React.FC<NodeProps<ForgeNode>> = memo((props) => (
  <ForgeNodeBase {...props} />
))
ForgeInputNode.displayName = 'ForgeInputNode'
