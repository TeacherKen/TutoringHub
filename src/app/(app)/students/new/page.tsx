import { requireTutor } from "@/lib/auth";
import { StudentForm } from "@/components/StudentForm";
import { createStudent } from "@/app/actions/students";
import { SoundLink } from "@/components/glass/SoundLink";

export default async function NewStudentPage() {
  await requireTutor();
  return (
    <div className="flex flex-col gap-5">
      <SoundLink href="/students" sound="nav" className="inline-flex min-h-11 items-center gap-1 self-start px-1.5 font-medium text-accent">
        ‹ Students
      </SoundLink>
      <h1 className="font-display -mt-3 px-1.5 text-[36px] font-semibold leading-tight sm:text-[44px]">Add student</h1>
      <div className="glass-hi rounded-[26px] p-5 sm:p-7">
        <StudentForm action={createStudent} submitLabel="Save student" />
      </div>
    </div>
  );
}
