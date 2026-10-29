import Link from "next/link";
import { requireTutor } from "@/lib/auth";
import { StudentForm } from "@/components/StudentForm";
import { createStudent } from "@/app/actions/students";

export default async function NewStudentPage() {
  await requireTutor();
  return (
    <div className="space-y-6">
      <Link href="/students" className="text-sm text-accent">
        ‹ Students
      </Link>
      <h1 className="h1">Add student</h1>
      <div className="card">
        <StudentForm action={createStudent} submitLabel="Save student" />
      </div>
    </div>
  );
}
