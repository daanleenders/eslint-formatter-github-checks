import { checkConclusion } from "./enums/checkConclusion";
import { checkStatus } from "./enums/checkStatus";
import { annotationLevel } from "./enums/annotationLevel";
import { messageSeverity } from "./enums/messageSeverity";

const summaryOfResults = (results) => {
  const summary = results.reduce(
    (seq, current) => {
      seq.errors += current.errorCount;
      seq.warnings += current.warningCount;
      seq.fixableErrors += current.fixableErrorCount;
      seq.fixableWarnings += current.fixableWarningCount;
      return seq;
    },
    { errors: 0, warnings: 0, fixableErrors: 0, fixableWarnings: 0 }
  );
  summary.problems = summary.errors + summary.warnings;
  summary.filesChecked = results.length;

  return summary;
};

function annotationsForResults(results) {
  const files = results.filter((result) => result.messages.length > 0);
  let annotations = [];

  let [basePath] = __dirname.split("node_modules");

  for (const file of files) {
    for (const message of file.messages) {
      const annotation = {
        path: file.filePath.substring(basePath.length),
        start_line: message.line,
        end_line: message.line,
        start_column: message.column,
        end_column: message.column,
        annotation_level:
          message.severity === messageSeverity.WARNING
            ? annotationLevel.WARNING
            : annotationLevel.FAILURE,
        message: message.message,
        title: message.ruleId || "Eslint fatal error",
      };

      annotations.push(annotation);

      if (annotations.length === 50) return annotations;
    }
  }

  return annotations;
}

const githubChecksFormatter = (results) => {
  const summary = summaryOfResults(results);

  const check = {
    status: checkStatus.COMPLETED,
    completed_at: new Date().toISOString().split(".")[0] + "Z", //Github expects ISO 8601 format without milliseconds
  };

  //No results provided means we haven't checked any files
  if (summary.filesChecked === 0) {
    check.conclusion = checkConclusion.SKIPPED;
    check.output = {
      title: "Nothing to check",
      summary:
        "Eslint received no files or rules to check. Adjust your ESLint config to make sure it has files to check" +
        " and rules to check them by",
    };
  } else if (summary.problems === 0) {
    check.conclusion = checkConclusion.SUCCESS;
    check.output = {
      title: "0 problems detected",
      summary: `Checked ${results.length} files and didn't find any problems`,
    };
  } else {
    check.conclusion = checkConclusion.FAILURE;
    check.output = {
      title: `${summary.problems} problem(s) detected`,
      summary: `${summary.errors} errors and ${summary.warnings} warnings found.
      ${summary.fixableErrors} errors and ${summary.fixableWarnings} warnings potentially fixable with the \`--fix\` option.`,
    };

    if (summary.problems > 50) {
      check.output.text =
        "Annotated only the first 50 problems due to limitations in the Github API";
    }

    check.output.annotations = annotationsForResults(results);
  }

  return JSON.stringify(check);
};

module.exports = githubChecksFormatter;
