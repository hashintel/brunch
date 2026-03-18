import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
} from "typeorm";
import { Entry } from "./Entry";

@Entity()
export class Project {
  @PrimaryGeneratedColumn()
  pk: number;

  @Column({ length: 255, nullable: true })
  name: string;

  @Column({ type: "text", nullable: true })
  goal: string;

  @Column({ length: 255, nullable: true })
  folder: string;

  @OneToMany(() => Entry, (r) => r.project)
  entries: Entry[];
}
