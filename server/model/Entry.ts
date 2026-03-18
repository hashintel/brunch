import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
  Check,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";
import { Project } from "./Project";

export enum Stage {
  PROPOSAL = "proposal",
  APPROVED = "approved",
  COMPLETED = "completed",
}

@Entity()
@Check(`"confidence" >= 0 AND "confidence" <= 1`)
export class Entry {
  @PrimaryGeneratedColumn()
  pk: number;

  @Column({ length: 255, nullable: true })
  title: string;

  @Column({ type: "text", nullable: true })
  description: string;

  @Column({ type: "text", nullable: true })
  test: string;

  @Column({
    type: "enum",
    enum: Stage,
    nullable: true,
  })
  stage: Stage;

  // 🔗 Project relation
  @Index()
  @ManyToOne(() => Project, (p) => p.requirements, {
    onDelete: "CASCADE", // delete requirements if project is deleted
  })
  @JoinColumn({ name: "project_id" })
  project: Project;

  // 🌳 Self-referencing tree
  @Index()
  @ManyToOne(() => Entry, (r) => r.children, {
    nullable: true,
    onDelete: "SET NULL",
  })
  @JoinColumn({ name: "parent_id" })
  parent: Entry;

  @OneToMany(() => Entry, (r) => r.parent)
  children: Entry[];

  // 🕒 timestamps (auto-managed)
  @CreateDateColumn({ name: "created_at" })
  created_at: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updated_at: Date;

  @Column({ type: "float", nullable: true })
  confidence: number;
}