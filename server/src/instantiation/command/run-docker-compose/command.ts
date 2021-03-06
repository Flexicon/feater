import {EnvVariablesSet} from '../../sets/env-variables-set';
import {SimpleCommand} from '../../executor/simple-command';

export class RunDockerComposeCommand extends SimpleCommand {

    constructor(
        readonly sourceDockerVolumeName: string,
        readonly envDirRelativePath: string,
        readonly composeFileRelativePaths: string[],
        readonly envVariables: EnvVariablesSet,
        readonly workingDirectory: string,
    ) {
        super();
    }

}
