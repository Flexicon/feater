import {createReadStream} from 'fs';
import {spawn} from 'child_process';
import {Injectable} from '@nestjs/common';
import {config} from '../../../config/config';
import {AssetRepository} from '../../../persistence/repository/asset.repository';
import {SimpleCommandExecutorComponentInterface} from '../../executor/simple-command-executor-component.interface';
import {SpawnHelper} from '../../helper/spawn-helper.component';
import {AssetHelper} from '../../../persistence/helper/asset-helper.component';
import {SimpleCommand} from '../../executor/simple-command';
import {EnvVariablesSet} from '../../sets/env-variables-set';
import {CreateAssetVolumeCommandResultInterface} from './command-result.interface';
import {CreateAssetVolumeCommand} from './command';
import {FeaterVariablesSet} from '../../sets/feater-variables-set';
import {CommandLogger} from '../../logger/command-logger';

@Injectable()
export class CreateAssetVolumeCommandExecutorComponent implements SimpleCommandExecutorComponentInterface {

    constructor(
        private readonly assetRepository: AssetRepository,
        private readonly assetHelper: AssetHelper,
        private readonly spawnHelper: SpawnHelper,
    ) {}

    supports(command: SimpleCommand): boolean {
        return (command instanceof CreateAssetVolumeCommand);
    }

    async execute(command: SimpleCommand): Promise<any> {
        const {
            volumeId,
            assetId,
            containerNamePrefix,
            absoluteGuestInstanceDirPath,
            commandLogger,
        } = command as CreateAssetVolumeCommand;

        commandLogger.info(`Asset ID: ${assetId}`);
        commandLogger.info(`Volume ID: ${volumeId}`);

        const asset = await this.assetRepository.findUploadedById(assetId);

        const dockerVolumeName = `${containerNamePrefix}_asset_volume_${volumeId}`;
        commandLogger.info(`Volume name: ${dockerVolumeName}`);

        commandLogger.info(`Creating volume.`);
        await this.createVolume(
            dockerVolumeName,
            absoluteGuestInstanceDirPath,
            commandLogger,
        );

        commandLogger.info(`Extracting asset to volume.`);
        await this.extractAssetToVolume(
            this.assetHelper.getUploadPaths(asset).absolute,
            dockerVolumeName,
            absoluteGuestInstanceDirPath,
            commandLogger,
        );

        const envVariables = new EnvVariablesSet();
        envVariables.add(`FEATER__ASSET_VOLUME__${volumeId.toUpperCase()}`, dockerVolumeName);
        commandLogger.infoWithEnvVariables(envVariables);

        const featerVariables = new FeaterVariablesSet();
        featerVariables.add(`asset_volume__${volumeId.toLowerCase()}`, dockerVolumeName);
        commandLogger.infoWithFeaterVariables(featerVariables);

        return {
            dockerVolumeName,
            envVariables,
            featerVariables,
        } as CreateAssetVolumeCommandResultInterface;
    }

    protected createVolume(
        volumeName: string,
        workingDirectory: string,
        commandLogger: CommandLogger,
    ): Promise<void> {
        return this.spawnHelper.promisifySpawnedWithHeader(
            spawn(
                config.instantiation.dockerBinaryPath,
                ['volume', 'create', '--name', volumeName],
                {cwd: workingDirectory},
            ),
            commandLogger,
            'create asset volume',
        );
    }

    protected extractAssetToVolume(
        absoluteUploadedAssetGuestPath: string,
        volumeName: string,
        workingDirectory: string,
        commandLogger,
    ): Promise<void> {
        const spawnedExtractAndCreateVolume = spawn(
            config.instantiation.dockerBinaryPath,
            [
                'run', '--rm', '-i',
                '-v', `${volumeName}:/target`,
                'alpine:3.9', 'ash', '-c', 'cat > /source.tar.gz && tar -zxvf /source.tar.gz -C /target/',
            ],
            {cwd: workingDirectory},
        );

        createReadStream(absoluteUploadedAssetGuestPath).pipe(spawnedExtractAndCreateVolume.stdin);

        return this.spawnHelper.promisifySpawnedWithHeader(
            spawnedExtractAndCreateVolume,
            commandLogger,
            'extract asset archive to volume',
        );
    }

}
