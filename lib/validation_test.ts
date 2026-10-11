import { assertEquals } from "@std/assert";
import {
  isRealDate,
  validateBirthday,
  validatePassword,
  validateProfile,
  validateSignUp,
  validateUsername,
} from "./validation.ts";

const TODAY = new Date("2026-10-11T12:00:00Z");

Deno.test("isRealDate", () => {
  for (const ok of ["1990-01-01", "2024-02-29", "2000-12-31"]) {
    assertEquals(isRealDate(ok), true, ok);
  }
  for (
    const bad of [
      "2026-02-31",
      "2023-02-29",
      "1990-13-01",
      "1990-00-10",
      "90-01-01",
      "1990/01/01",
      "",
      "1990-1-1",
      "abcd-ef-gh",
    ]
  ) {
    assertEquals(isRealDate(bad), false, bad);
  }
});

Deno.test("validateUsername: 3-32 characters of letters, numbers, . - _", () => {
  for (const ok of ["abc", "Ana.Silva_1", "a-b", "x".repeat(32)]) {
    assertEquals(validateUsername(ok), undefined, ok);
  }
  assertEquals(validateUsername("ab"), "Must be 3–32 characters");
  assertEquals(validateUsername("x".repeat(33)), "Must be 3–32 characters");
  for (const bad of ["mara costa", "ana@test.dev", "ána", "ana!"]) {
    assertEquals(
      validateUsername(bad),
      'May only contain letters, numbers, ".", "-" and "_"',
      bad,
    );
  }
});

Deno.test("validatePassword: 8-128, counting characters", () => {
  assertEquals(validatePassword("12345678"), undefined);
  assertEquals(validatePassword("x".repeat(128)), undefined);
  assertEquals(validatePassword("12345"), "Must be 8–128 characters (5 now)");
  assertEquals(
    validatePassword("x".repeat(129)),
    "Must be 8–128 characters (129 now)",
  );
  // 8 caracteres acentuados valem 8, não os bytes.
  assertEquals(validatePassword("ááááááá"), "Must be 8–128 characters (7 now)");
  assertEquals(validatePassword("áááááááá"), undefined);
});

Deno.test("validateBirthday: required, real, not in the future", () => {
  assertEquals(validateBirthday("1990-01-01", TODAY), undefined);
  assertEquals(validateBirthday("2026-10-11", TODAY), undefined);
  assertEquals(validateBirthday("", TODAY), "Required");
  assertEquals(
    validateBirthday("1990-1-1", TODAY),
    "Use the format YYYY-MM-DD",
  );
  assertEquals(
    validateBirthday("2026-02-31", TODAY),
    "Use the format YYYY-MM-DD",
  );
  assertEquals(validateBirthday("2026-10-12", TODAY), "Can't be in the future");
});

Deno.test("validateProfile and validateSignUp collect every error at once", () => {
  assertEquals(
    validateProfile({
      first_name: "Mara",
      last_name: "Costa",
      birthday: "1990-01-01",
    }, TODAY),
    {},
  );
  assertEquals(
    validateProfile({
      first_name: "  ",
      last_name: "x".repeat(101),
      birthday: "",
    }, TODAY),
    {
      first_name: "Required",
      last_name: "At most 100 characters",
      birthday: "Required",
    },
  );
  assertEquals(
    validateSignUp(
      {
        username: "mara costa",
        password: "12345",
        first_name: "Mara",
        last_name: "Costa",
        birthday: "",
      },
      TODAY,
    ),
    {
      username: 'May only contain letters, numbers, ".", "-" and "_"',
      password: "Must be 8–128 characters (5 now)",
      birthday: "Required",
    },
  );
});
